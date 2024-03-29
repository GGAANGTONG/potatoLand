import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { BoardService } from "./board.service";
import { CreateBoardDto } from "./dto/createBoard.dto";
import { User } from "../user/entity/user.entity";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { UpdateBoardDto } from "./dto/updateBoard.dto";
import { InviteBoardDto } from "./dto/inviteBoard.dto";
import { UserInfo } from "../user/decorator/userInfo.decorator";
import { UpdateMemberDto } from "./dto/updateMember.dto";
import { DeleteMemberDto } from "./dto/deleteMember.dto";
import { RolesGuard } from "../auth/roles.guard";
import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";

@ApiTags("Board")
@UseGuards(RolesGuard)
@Controller("board")
@UseInterceptors(CacheInterceptor)
@CacheTTL(30)
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @ApiOperation({ summary: "보드 생성하기" })
  @Post()
  async createBoard(
    @UserInfo() user: User,
    @Body() createBoardDto: CreateBoardDto,
  ) {
    const board = await this.boardService.createBoard(user, createBoardDto);
    return {
      statusCode: HttpStatus.CREATED,
      message: "보드가 생성되었습니다.",
      board,
    };
  }

  @ApiOperation({ summary: "보드에 초대하기" })
  @Post(":id/invite")
  async invite(
    @UserInfo() user: User,
    @Param("id") id: number,
    @Body() inviteBoardDto: InviteBoardDto,
  ) {
    return await this.boardService.invite(user, id, inviteBoardDto);
  }

  @ApiOperation({ summary: "초대 승인하기" })
  @Get("confirm")
  async confirm(@Query("token") token: string) {
    return await this.boardService.confirm(token);
  }

  @ApiOperation({ summary: "보드 수정하기" })
  @Patch(":id")
  async updateBoard(
    @UserInfo() user: User,
    @Param("id") id: number,
    @Body() updateBoardDto: UpdateBoardDto,
  ) {
    return await this.boardService.updateBoard(user, id, updateBoardDto);
  }

  @ApiOperation({ summary: "보드 삭제하기" })
  @Delete(":id")
  async deleteBoard(@UserInfo() user: User, @Param("id") id: number) {
    return await this.boardService.deleteBoard(user, id);
  }

  @ApiOperation({ summary: "보드 상세 조회하기" })
  @Get(":id")
  async getBoardById(@UserInfo() user: User, @Param("id") id: number) {
    return await this.boardService.getBoardById(user, id);
  }

  @ApiOperation({ summary: "보드의 관리자가 보드 멤버의 권한 변경하기" })
  @Patch(":id/changeRole")
  async updateMemberRole(
    @UserInfo() user: User,
    @Param("id") id: number,
    @Body() updateMemberDto: UpdateMemberDto,
  ) {
    return await this.boardService.updateMemberRole(user, id, updateMemberDto);
  }

  @ApiOperation({ summary: "보드의 관리자가 보드 멤버 삭제하기" })
  @Delete(":id/deleteMember")
  async deleteMember(
    @UserInfo() user: User,
    @Param("id") id: number,
    @Body() deleteMemberDto: DeleteMemberDto,
  ) {
    return await this.boardService.deleteMember(user, id, deleteMemberDto);
  }
}
