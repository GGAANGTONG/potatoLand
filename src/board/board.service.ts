import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Board } from "./entities/board.entity";
import { BoardMember } from "./entities/boardMember.entity";
import { CreateBoardDto } from "./dto/createBoard.dto";
import { User } from "../user/entity/user.entity";
import _ from "lodash";
import { BoardMemberType } from "./types/boardMember.type";
import { UpdateBoardDto } from "./dto/updateBoard.dto";
import { InviteBoardDto } from "./dto/inviteBoard.dto";
import { JsonWebTokenError, JwtService, TokenExpiredError } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { UpdateMemberDto } from "./dto/updateMember.dto";
import { DeleteMemberDto } from "./dto/deleteMember.dto";

@Injectable()
export class BoardService {
  constructor(
    @InjectRepository(Board)
    private readonly boardRepository: Repository<Board>,
    @InjectRepository(BoardMember)
    private readonly boardMemberRepository: Repository<BoardMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async createBoard(user: User, createBoardDto: CreateBoardDto) {
    const { name, backgroundColor, description, visibility, inviteOption } =
      createBoardDto;
    const newBoard = await this.boardRepository.save({
      name,
      backgroundColor,
      description,
      visibility,
      inviteOption,
      createdBy: user,
    });

    await this.boardMemberRepository.save({
      board: newBoard,
      user,
      role: BoardMemberType.ADMIN,
    });

    return newBoard;
  }

  async updateBoard(user: User, id: number, updateBoardDto: UpdateBoardDto) {
    if (_.isNaN(id)) {
      throw new BadRequestException("잘못된 형식의 URL입니다.");
    }

    const board = await this.getBoardAndRelations(id);
    const boardMember = board.members.filter(
      (boardMember) => boardMember.user.id === user.id,
    );

    // 보드의 member, admin, guest만 수정이 가능하다.
    // 보드의 observer이거나, 아예 보드의 멤버가 아니라면 수정 불가능.
    if (boardMember.length === 0 || boardMember[0].role === "observer") {
      throw new ForbiddenException("인가되지 않은 권한입니다.");
    }

    await this.boardRepository.update({ id }, updateBoardDto);
    return { message: "성공적으로 수정되었습니다" };
  }

  async deleteBoard(user: User, id: number) {
    if (_.isNaN(id)) {
      throw new BadRequestException("잘못된 형식의 URL입니다.");
    }

    const board = await this.getBoardAndRelations(id);

    // 생성한 사용자만 삭제 가능.
    if (board.createdBy.id != user.id) {
      throw new ForbiddenException("인가되지 않은 권한입니다.");
    }

    await this.boardRepository.softDelete({ id });

    return { message: "성공적으로 삭제되었습니다." };
  }

  async getBoardById(user: User, id: number) {
    if (_.isNaN(id)) {
      throw new BadRequestException("잘못된 형식의 URL입니다.");
    }
    const board = await this.getBoardAndRelations(id);
    const boardMember = board.members.filter(
      (boardMember) => boardMember.user.id === user.id,
    );

    // board visibility가 public이면 누구나 조회 가능, private이면 보드의 멤버만 조회 가능
    if (board.visibility === "private" && boardMember.length === 0) {
      throw new ForbiddenException("인가되지 않은 권한입니다.");
    }

    return board;
  }

  async invite(user: User, id: number, inviteBoardDto: InviteBoardDto) {
    if (_.isNaN(id)) {
      throw new BadRequestException("잘못된 형식의 URL입니다.");
    }

    const board = await this.getBoardAndRelations(id);
    const boardMember = board.members.filter(
      (boardMember) => boardMember.user.id === user.id,
    );

    // 보드의 inviteOption이 all이면 보드의 멤버 누구나 초대 가능, adminOnly면 보드의 관리자만 초대 가능
    if (
      boardMember.length === 0 ||
      (board.inviteOption === "adminOnly" && boardMember[0].role !== "admin")
    ) {
      throw new ForbiddenException("인가되지 않은 권한입니다.");
    }
    const { userId } = inviteBoardDto;
    const { expiresIn } = inviteBoardDto;
    let { role } = inviteBoardDto;

    const isExist = board.members.filter(
      (boardMember) => boardMember.user.id === userId,
    );
    if (isExist.length !== 0) {
      throw new BadRequestException("이미 초대된 사용자입니다.");
    }

    const memberRole = boardMember[0].role;
    if (memberRole === "member" && role === "admin") {
      throw new ForbiddenException(
        `'member'는 member, guest, observer만 초대할 수 있습니다.`,
      );
    } else if (
      memberRole === "guest" &&
      (role === "admin" || role === "member")
    ) {
      throw new ForbiddenException(
        `'guest'는 guest, observer만 초대할 수 있습니다.`,
      );
    } else if (memberRole === "observer" && role !== "observer") {
      throw new ForbiddenException(
        `'observer'는 observer만 초대할 수 있습니다.`,
      );
    }
    if (_.isNil(role)) {
      role = memberRole;
    }
    const payload = { userId, role, boardId: id };
    const token = this.jwtService.sign(payload, { expiresIn: `${expiresIn}h` });
    const inviteLink = `http://localhost:${this.configService.get<string>("SERVER_PORT")}/api/board/confirm?token=${token}`;
    const sendTo = await this.userRepository.findOneBy({ id: userId });

    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: this.configService.get<string>("GMAIL_USER_BOARD"),
        pass: this.configService.get<string>("GMAIL_PASS_BOARD"),
      },
    });

    await transporter.sendMail({
      from: this.configService.get<string>("GMAIL_USER_BOARD"),
      to: sendTo.email,
      subject: `potatoLand: you are currently invited to board no.${id}`,
      html: `<p>Click <a href="${inviteLink}">here</a> to accept invitation</p>`,
    });

    return { message: "초대 링크가 해당 사용자의 이메일로 전송되었습니다." };
  }

  async confirm(token: string) {
    try {
      const decodedToken = this.jwtService.verify(token, {
        secret: this.configService.get<string>("JWT_SECRET_BOARD"),
      });
      const { userId, boardId, role } = decodedToken;

      const user = await this.userRepository.findOneBy({ id: userId });
      if (_.isNil(user)) {
        throw new NotFoundException("존재하지 않는 사용자입니다.");
      }
      const board = await this.boardRepository.findOneBy({ id: boardId });
      if (_.isNil(board)) {
        throw new NotFoundException("존재하지 않는 보드입니다.");
      }
      await this.boardMemberRepository.save({
        board,
        user,
        role,
      });

      return { message: `${boardId}번 보드에 초대되셨습니다.` };
    } catch (err) {
      if (
        err instanceof TokenExpiredError ||
        err instanceof JsonWebTokenError
      ) {
        throw new UnauthorizedException("유효하지 않은 토큰입니다.");
      }
      throw err;
    }
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////

  async updateMemberRole(
    user: User,
    id: number,
    updateMemberDto: UpdateMemberDto,
  ) {
    if (_.isNaN(id)) {
      throw new BadRequestException("잘못된 형식의 URL입니다.");
    }

    // 보드의 관리자만 권한 변경 가능.
    const board = await this.getBoardAndRelations(id);
    const boardMember = board.members.filter(
      (boardMember) => boardMember.user.id === user.id,
    );
    if (boardMember.length === 0 || boardMember[0].role !== "admin") {
      throw new ForbiddenException("인가되지 않은 권한입니다.");
    }

    const { memberId, role } = updateMemberDto;
    const changeMember = board.members.filter(
      (boardMember) => boardMember.id === memberId,
    );
    if (changeMember.length === 0) {
      throw new NotFoundException("존재하지 않는 멤버입니다.");
    }
    await this.boardMemberRepository.update({ id: memberId }, { role });

    return { message: `해당 멤버의 권한이 ${role}(으)로 변경되었습니다.` };
  }

  async deleteMember(user: User, id: number, deleteMemberDto: DeleteMemberDto) {
    if (_.isNaN(id)) {
      throw new BadRequestException("잘못된 형식의 URL입니다.");
    }

    // 보드의 관리자만 권한 변경 가능.
    const board = await this.getBoardAndRelations(id);
    const boardMember = board.members.filter(
      (boardMember) => boardMember.user.id === user.id,
    );
    if (boardMember.length === 0 || boardMember[0].role !== "admin") {
      throw new ForbiddenException("인가되지 않은 권한입니다.");
    }

    const { memberId } = deleteMemberDto;
    const changeMember = board.members.filter(
      (boardMember) => boardMember.id === memberId,
    );
    if (changeMember.length === 0) {
      throw new NotFoundException("존재하지 않는 멤버입니다.");
    }

    if (changeMember[0].role === "admin") {
      throw new ForbiddenException("보드의 관리자를 삭제할 수 없습니다.");
    }

    await this.boardMemberRepository.delete({ id: memberId });

    return { message: "보드에서 해당 멤버가 삭제되었습니다." };
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////

  async getBoardAndRelations(id: number) {
    const board = await this.boardRepository
      .createQueryBuilder("board")
      .leftJoinAndSelect("board.createdBy", "createdBy")
      .leftJoinAndSelect("board.members", "members")
      .leftJoinAndSelect("members.user", "user")
      .where("board.id = :id", { id })
      .getOne();

    if (_.isNil(board)) {
      throw new NotFoundException(
        "해당 요청에 필요한 결과를 찾을 수 없습니다.",
      );
    }

    return board;
  }
}
