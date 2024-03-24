import { Test, TestingModule } from "@nestjs/testing";
import { BoardService } from "./board.service";
import { JsonWebTokenError, JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Board } from "./entities/board.entity";
import { Repository } from "typeorm";
import { BoardMember } from "./entities/boardMember.entity";
import { getRepositoryToken } from "@nestjs/typeorm";
import { User } from "../user/entity/user.entity";
import { CreateBoardDto } from "./dto/createBoard.dto";
import { BoardVisibility } from "./types/boardVisibility.type";
import { InviteOption } from "./types/inviteOption.type";
import { BoardMemberType } from "./types/boardMember.type";
import { UpdateBoardDto } from "./dto/updateBoard.dto";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { InviteBoardDto } from "./dto/inviteBoard.dto";
import * as nodemailer from "nodemailer";
import { UpdateMemberDto } from "./dto/updateMember.dto";
import { DeleteMemberDto } from "./dto/deleteMember.dto";

let sendMailMock = jest.fn().mockResolvedValue(true); // sendMail 메서드를 모킹
jest.mock("nodemailer", () => ({
  createTransport: () => ({
    sendMail: sendMailMock,
  }),
}));

describe("BoardService", () => {
  let boardService: BoardService;
  let jwtService: Partial<JwtService>;
  let configService: Partial<ConfigService>;
  let boardRepository: Partial<Record<keyof Repository<Board>, jest.Mock>>;
  let boardMemberRepository: Partial<
    Record<keyof Repository<BoardMember>, jest.Mock>
  >;
  let userRepository: Partial<Record<keyof Repository<User>, jest.Mock>>;

  beforeEach(async () => {
    boardRepository = {
      save: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      findOneBy: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockReturnValue([]),
      }),
    };

    boardMemberRepository = {
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    userRepository = {
      findOneBy: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue("jwt-token"),
      verify: jest.fn().mockReturnValue({
        userId: 3,
        boardId: 1,
        role: BoardMemberType.MEMBER,
      }),
    };

    configService = {
      get: jest.fn((key) => {
        if (key === "JWT_SECRET_BOARD") return "jwt-secret-board";
        else if (key === "SERVER_PORT") return "server-port";
        else if (key === "GMAIL_USER_BOARD") return "gmail-user-board";
        else if (key === "GMAIL_PASS_BOARD") return "gmail-pass-board";
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardService,
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: getRepositoryToken(Board),
          useValue: boardRepository,
        },
        {
          provide: getRepositoryToken(BoardMember),
          useValue: boardMemberRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    boardService = module.get<BoardService>(BoardService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(boardService).toBeDefined();
  });

  /////////////////////////// variables /////////////////////////////////////

  const user = {
    id: 1,
    email: "test@test.com",
    password: "testing0*",
    name: "test",
  } as User;

  const boardMember = {
    id: 1,
    role: BoardMemberType.ADMIN,
    user,
  } as BoardMember;

  const secondUser = {
    id: 2,
    email: "test2@test.com",
    password: "testing0*",
    name: "test2",
  } as User;

  const secondBoardMember = {
    id: 2,
    role: BoardMemberType.MEMBER,
    user: secondUser,
  } as BoardMember;

  const board = {
    id: 1,
    name: "test",
    description: "test",
    backgroundColor: "cornflowerblue",
    visibility: BoardVisibility.PRIVATE,
    inviteOption: InviteOption.ALL_MEMBER,
    createdBy: user,
    members: [boardMember, secondBoardMember],
  } as Board;

  const mockUser = {
    id: 999,
    email: "test999@test.com",
    password: "testing0*",
    name: "test999",
  } as User;

  ////////////////////////////////////////////////////////////////////////////

  describe("createBoard test", () => {
    it("should create a board and return board", async () => {
      const createBoardDto = {
        name: "test",
        backgroundColor: "cornflowerblue",
        description: "test",
        visibility: BoardVisibility.PRIVATE,
        inviteOption: InviteOption.ALL_MEMBER,
      } as CreateBoardDto;

      const newBoard = { ...board, members: [boardMember] } as Board;

      boardRepository.save.mockResolvedValue(newBoard);

      // act
      const result = await boardService.createBoard(user, createBoardDto);

      // assert
      expect(boardRepository.save).toHaveBeenCalledWith({
        ...createBoardDto,
        createdBy: user,
      });
      expect(boardMemberRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          board: newBoard,
          user,
          role: BoardMemberType.ADMIN,
        }),
      );
      expect(result).toEqual(newBoard);
    });
  });

  ///////////////////////////////////////////////////////////////////////////////

  describe("updateBoard test", () => {
    const updateBoardDto = {
      backgroundColor: "magenta pink",
    } as UpdateBoardDto;

    it("should update a specified board and return message", async () => {
      boardRepository.createQueryBuilder().getOne.mockReturnValue(board);

      // act
      const result = await boardService.updateBoard(user, 1, updateBoardDto);

      // assert
      expect(boardRepository.update).toHaveBeenCalledTimes(1);
      expect(boardRepository.update).toHaveBeenCalledWith(
        { id: 1 },
        updateBoardDto,
      );
      expect(result).toEqual({ message: "성공적으로 수정되었습니다" });
    });

    it("should throw ForbiddenException if you are not member of board", async () => {
      boardRepository.createQueryBuilder().getOne.mockReturnValue(board);

      await expect(
        boardService.updateBoard(mockUser, 1, updateBoardDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw ForbiddenException if you are observer", async () => {
      const observerBoardMember = {
        id: 1,
        role: BoardMemberType.OBSERVER,
        user: secondUser,
      } as BoardMember;

      const board = {
        id: 1,
        backgroundColor: "cornflowerblue",
        createdBy: user,
        members: [boardMember, observerBoardMember],
      } as Board;

      boardRepository.createQueryBuilder().getOne.mockReturnValue(board);

      await expect(
        boardService.updateBoard(secondUser, 1, updateBoardDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw NotFoundException if specified board not exists", async () => {
      boardRepository.createQueryBuilder().getOne.mockReturnValue(null);

      await expect(
        boardService.updateBoard(user, 999, updateBoardDto),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if id from parameter is NaN", async () => {
      await expect(
        boardService.updateBoard(user, NaN, updateBoardDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  ///////////////////////////////////////////////////////////////////////////////

  describe("deleteBoard test", () => {
    it("should delete a specifed board and return message", async () => {
      boardRepository.createQueryBuilder().getOne.mockReturnValue(board);

      // act
      const result = await boardService.deleteBoard(user, 1);

      // assert
      expect(boardRepository.softDelete).toHaveBeenCalledTimes(1);
      expect(boardRepository.softDelete).toHaveBeenCalledWith({ id: 1 });
      expect(result).toEqual({ message: "성공적으로 삭제되었습니다." });
    });

    it("should throw ForbiddenException if you did not create specified board", async () => {
      boardRepository.createQueryBuilder().getOne.mockReturnValue(board);

      await expect(boardService.deleteBoard(secondUser, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should throw NotFoundException if specified board not exists", async () => {
      boardRepository.createQueryBuilder().getOne.mockReturnValue(null);

      await expect(boardService.deleteBoard(user, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw BadRequestException if id from parameter is NaN", async () => {
      await expect(boardService.deleteBoard(user, NaN)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  ///////////////////////////////////////////////////////////////////////////////

  describe("getBoardById test", () => {
    it("should return a specified board if you are member of a specified board", async () => {
      boardRepository.createQueryBuilder().getOne.mockReturnValue(board);

      // act
      const result = await boardService.getBoardById(user, 1);

      // assert
      expect(boardRepository.createQueryBuilder().getOne).toHaveBeenCalledTimes(
        1,
      );
      expect(result).toEqual(board);
    });

    it("should return a specified board if board is public", async () => {
      const publicBoard = { ...board, visibility: BoardVisibility.PUBLIC };

      boardRepository.createQueryBuilder().getOne.mockReturnValue(publicBoard);

      // act
      const result = await boardService.getBoardById(mockUser, 1);

      // assert
      expect(boardRepository.createQueryBuilder().getOne).toHaveBeenCalledTimes(
        1,
      );
      expect(result).toEqual(publicBoard);
    });

    it("should throw ForbiddenException if specified board is private and you are not member of board", async () => {
      boardRepository.createQueryBuilder().getOne.mockReturnValue(board);

      await expect(boardService.getBoardById(mockUser, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should throw NotFoundException if specified board not exists", async () => {
      boardRepository.createQueryBuilder().getOne.mockReturnValue(null);

      await expect(boardService.getBoardById(user, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw BadRequestException if id from parameter is NaN", async () => {
      await expect(boardService.getBoardById(user, NaN)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  ///////////////////////////////////////////////////////////////////////////////

  describe("invite test", () => {
    const inviteBoardDto = {
      userId: 3,
      role: BoardMemberType.MEMBER,
      expiresIn: 12,
    } as InviteBoardDto;

    it("should send invitation email and return message", async () => {
      const sendTo = {
        id: 3,
        email: "test3@test.com",
        password: "testing0*",
        name: "test3",
      } as User;
      boardRepository.createQueryBuilder().getOne.mockReturnValue(board);
      userRepository.findOneBy.mockResolvedValue(sendTo);

      // act
      const result = await boardService.invite(user, 1, inviteBoardDto);

      // assert
      expect(boardRepository.createQueryBuilder().getOne).toHaveBeenCalledTimes(
        1,
      );
      expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: 3 });
      const payload = {
        userId: inviteBoardDto.userId,
        role: inviteBoardDto.role,
        boardId: 1,
      };
      expect(jwtService.sign).toHaveBeenCalledWith(payload, {
        expiresIn: `${inviteBoardDto.expiresIn}h`,
      });
      expect(sendMailMock).toHaveBeenCalled();
      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: sendTo.email,
          subject: `potatoLand: you are currently invited to board no.1`,
        }),
      );
      expect(result).toEqual({
        message: "초대 링크가 해당 사용자의 이메일로 전송되었습니다.",
      });
    });

    it("should throw ForbiddenException if you are not member of specified board", async () => {
      boardRepository.createQueryBuilder().getOne.mockReturnValue(board);

      await expect(
        boardService.invite(mockUser, 1, inviteBoardDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw ForbiddenException if specified board's invite option is adminOnly and you are not admin of board", async () => {
      const adminOnlyCanInviteBoard = {
        ...board,
        inviteOption: InviteOption.ADMIN_ONLY,
      };

      boardRepository
        .createQueryBuilder()
        .getOne.mockReturnValue(adminOnlyCanInviteBoard);

      await expect(
        boardService.invite(secondUser, 1, inviteBoardDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw BadRequestException if user you tried to invite is already member of board", async () => {
      const inviteYourselfDto = {
        userId: 1,
        role: BoardMemberType.MEMBER,
        expiresIn: 12,
      } as InviteBoardDto;

      boardRepository.createQueryBuilder().getOne.mockReturnValue(board);

      await expect(
        boardService.invite(user, 1, inviteYourselfDto),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw ForbiddenException if your role is 'member' but trying to invite new user as 'admin'", async () => {
      const inviteAsAdminDto = {
        userId: 3,
        role: BoardMemberType.ADMIN,
        expiresIn: 12,
      };

      boardRepository.createQueryBuilder().getOne.mockReturnValue(board);

      await expect(
        boardService.invite(secondUser, 1, inviteAsAdminDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw ForbiddenException if your role is 'guest' but trying to invite new user as 'member'", async () => {
      const guestBoardMember = {
        id: 2,
        role: BoardMemberType.GUEST,
        user: secondUser,
      } as BoardMember;

      const board = {
        id: 1,
        name: "test",
        description: "test",
        backgroundColor: "cornflowerblue",
        visibility: BoardVisibility.PRIVATE,
        inviteOption: InviteOption.ALL_MEMBER,
        createdBy: user,
        members: [boardMember, guestBoardMember],
      } as Board;

      boardRepository.createQueryBuilder().getOne.mockReturnValue(board);

      await expect(
        boardService.invite(secondUser, 1, inviteBoardDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw ForbiddenException if your role is 'observer' but trying to invite new user as 'not observer'", async () => {
      const observerBoardMember = {
        id: 2,
        role: BoardMemberType.OBSERVER,
        user: secondUser,
      } as BoardMember;

      const board = {
        id: 1,
        name: "test",
        description: "test",
        backgroundColor: "cornflowerblue",
        visibility: BoardVisibility.PRIVATE,
        inviteOption: InviteOption.ALL_MEMBER,
        createdBy: user,
        members: [boardMember, observerBoardMember],
      } as Board;

      boardRepository.createQueryBuilder().getOne.mockReturnValue(board);

      await expect(
        boardService.invite(secondUser, 1, inviteBoardDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw BadRequestException if id from parameter is NaN", async () => {
      await expect(
        boardService.invite(user, NaN, inviteBoardDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  ///////////////////////////////////////////////////////////////////////////////

  describe("confirm test", () => {
    const thirdUser = {
      id: 3,
      email: "test3@test.com",
      password: "testing0*",
      name: "test3",
    } as User;

    const thirdBoardMember = {
      id: 1,
      role: BoardMemberType.MEMBER,
      user: thirdUser,
    } as BoardMember;

    const token = "jwt-token";

    it("should put user into boardMember if token is verified", async () => {
      userRepository.findOneBy.mockResolvedValue(thirdUser);
      boardRepository.findOneBy.mockResolvedValue(board);

      // act
      const result = await boardService.confirm(token);

      // assert
      expect(jwtService.verify).toHaveBeenCalledTimes(1);
      expect(jwtService.verify).toHaveBeenCalledWith(token, {
        secret: "jwt-secret-board",
      });
      expect(userRepository.findOneBy).toHaveBeenCalledTimes(1);
      expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: 3 });
      expect(boardRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(result).toEqual({ message: `1번 보드에 초대되셨습니다.` });
    });

    it("should throw NotFoundException if user doesn't exist", async () => {
      userRepository.findOneBy.mockResolvedValue(null);
      await expect(boardService.confirm(token)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw NotFoundException if board doesn't exist", async () => {
      userRepository.findOneBy.mockResolvedValue(thirdUser);
      boardRepository.findOneBy.mockResolvedValue(null);
      await expect(boardService.confirm(token)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw UnauthorizedException if token is not valid", async () => {
      const falseToken = "false-jwt-token";

      userRepository.findOneBy.mockResolvedValue(thirdUser);
      boardRepository.findOneBy.mockResolvedValue(board);
      jest.spyOn(jwtService, "verify").mockImplementation(() => {
        throw new JsonWebTokenError("유효하지 않은 토큰입니다.");
      });

      await expect(boardService.confirm(falseToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  ///////////////////////////////////////////////////////////////////////////////

  describe("updateMemberRole test", () => {
    const updateMemberDto = {
      memberId: 2,
      role: BoardMemberType.ADMIN,
    } as UpdateMemberDto;

    it("should change a specified member's role with given data and return message", async () => {
      boardRepository.createQueryBuilder().getOne.mockResolvedValue(board);

      // act
      const result = await boardService.updateMemberRole(
        user,
        1,
        updateMemberDto,
      );

      // assert
      expect(boardRepository.createQueryBuilder().getOne).toHaveBeenCalledTimes(
        1,
      );
      expect(boardMemberRepository.update).toHaveBeenCalledTimes(1);
      expect(boardMemberRepository.update).toHaveBeenCalledWith(
        {
          id: 2,
        },
        { role: BoardMemberType.ADMIN },
      );
      expect(result).toEqual({
        message: `해당 멤버의 권한이 admin(으)로 변경되었습니다.`,
      });
    });

    it("should throw ForbiddenException if you are not member of board", async () => {
      boardRepository.createQueryBuilder().getOne.mockResolvedValue(board);

      await expect(
        boardService.updateMemberRole(mockUser, 1, updateMemberDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw ForbiddenException if you are not admin of board", async () => {
      boardRepository.createQueryBuilder().getOne.mockResolvedValue(board);

      await expect(
        boardService.updateMemberRole(secondUser, 1, updateMemberDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw NotFoundException if a member you tried to change role doesn't exist", async () => {
      const mockUpdateMemberDto = {
        memberId: 999,
        role: BoardMemberType.GUEST,
      } as UpdateMemberDto;

      boardRepository.createQueryBuilder().getOne.mockResolvedValue(board);

      await expect(
        boardService.updateMemberRole(user, 1, mockUpdateMemberDto),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if id from parameter is NaN", async () => {
      await expect(
        boardService.updateMemberRole(user, NaN, updateMemberDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  ///////////////////////////////////////////////////////////////////////////////

  describe("deleteMember test", () => {
    const deleteMemberDto = {
      memberId: 2,
    } as DeleteMemberDto;

    it("should delete a specified member from board and return message", async () => {
      boardRepository.createQueryBuilder().getOne.mockResolvedValue(board);

      // act
      const result = await boardService.deleteMember(user, 1, deleteMemberDto);

      // assert
      expect(boardRepository.createQueryBuilder().getOne).toHaveBeenCalledTimes(
        1,
      );
      expect(boardMemberRepository.delete).toHaveBeenCalledTimes(1);
      expect(boardMemberRepository.delete).toHaveBeenCalledWith({ id: 2 });
      expect(result).toEqual({
        message: "보드에서 해당 멤버가 삭제되었습니다.",
      });
    });

    it("should throw ForbiddenException if you are not member of board", async () => {
      boardRepository.createQueryBuilder().getOne.mockResolvedValue(board);

      await expect(
        boardService.deleteMember(mockUser, 1, deleteMemberDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw ForbiddenException if you are not admin of board", async () => {
      boardRepository.createQueryBuilder().getOne.mockResolvedValue(board);

      await expect(
        boardService.deleteMember(secondUser, 1, deleteMemberDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw NotFoundException if a member you tried to delete doesn't exist", async () => {
      const mockDeleteMemberDto = {
        memberId: 999,
      } as DeleteMemberDto;

      boardRepository.createQueryBuilder().getOne.mockResolvedValue(board);

      await expect(
        boardService.deleteMember(user, 1, mockDeleteMemberDto),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException if a member you tried to delete is admin of board", async () => {
      const deleteAdminMemberDto = {
        memberId: 1,
      } as DeleteMemberDto;

      boardRepository.createQueryBuilder().getOne.mockResolvedValue(board);

      await expect(
        boardService.deleteMember(user, 1, deleteAdminMemberDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw BadRequestException if id from parameter is NaN", async () => {
      await expect(
        boardService.deleteMember(user, NaN, deleteMemberDto),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
