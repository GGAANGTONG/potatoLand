import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateColumDto } from './dto/createColum.dto';
import { UpdateColumDto } from './dto/updateColum.dto';
import { In, Repository } from 'typeorm';
import { Colum } from './entities/colum.entity';
import { InjectRepository } from '@nestjs/typeorm';
import _, { isNil } from 'lodash';
import { ReorderColumDto } from './dto/reorderColum.dto';
import { User } from '../user/entity/user.entity';
import { BoardMember } from '../board/entities/boardMember.entity';

@Injectable()
export class ColumService {
  constructor(
    @InjectRepository(Colum)
    private readonly columRepository: Repository<Colum>,
    @InjectRepository(BoardMember)
    private readonly boardMemberRepository: Repository<BoardMember>,
  ) {}

  //컬럼 생성
  async create(user: User, createColumDto: CreateColumDto) {
    const { id: user_id } = user;
    const { columOrder, board_id, title } = createColumDto;

    const availableUser = await this.boardMemberRepository.findOne({
      relations: ["user"],
      where: {
        user: {
          id: user_id,
        },
      },
    });

    if (availableUser.role == "observer") {
      throw new UnauthorizedException("인가되지 않은 권합입니다.");
    }

    const colum = await this.columRepository.save({
      board_id,
      columOrder,
      title,
    });

    return colum;
  }

  //컬럼 이름 수정
  async update(user: User, updateColumDto: UpdateColumDto) {
    const { id: user_id } = user;
    const { board_id, id, title } = updateColumDto;
    console.log(board_id, id, title);

    const availableUser = await this.boardMemberRepository.findOne({
      relations: ["user"],
      where: {
        user: {
          id: user_id,
        },
      },
    });

    if (availableUser.role == "observer") {
      throw new UnauthorizedException("인가되지 않은 권합입니다.");
    }

    const existedColum = await this.columRepository.findOne({
      where: {
        id,
        board_id,
      },
    });
    if (_.isNil(existedColum)) {
      throw new BadRequestException("[존재하지 않음]유효하지 않은 요청입니다.");
    }

    const existedColumName = await this.columRepository.findOne({
      where: {
        title,
        board_id,
      },
    });
    if (existedColumName) {
      throw new BadRequestException("[중복된 제목]유효하지 않은 요청입니다.");
    }

    return await this.columRepository.update({ id }, { title });
  }
  //컬럼 삭제
  async remove(user: User, id: number) {
    const { id: user_id } = user;

    const availableUser = await this.boardMemberRepository.findOne({
      relations: ["user"],
      where: {
        user: {
          id: user_id,
        },
      },
    });

    if (availableUser.role == "observer") {
      throw new UnauthorizedException("인가되지 않은 권합입니다.");
    }

    const existedColum = await this.columRepository.findOneBy({ id });
    if (isNil(existedColum)) {
      throw new BadRequestException("유효하지 않은 요청입니다.");
    }

    return await this.columRepository.delete({ id });
  }

  //컬럼 순서 이동
  async reorderColum(user: User, { columIds, board_id }: ReorderColumDto) {
    const { id: user_id } = user;

    const availableUser = await this.boardMemberRepository.findOne({
      relations: ["user"],
      where: {
        user: {
          id: user_id,
        },
      },
    });

    if (availableUser.role == "observer") {
      throw new UnauthorizedException("인가되지 않은 권합입니다.");
    }

    const colums = await this.columRepository.find({
      where: {
        id: In(columIds),
      },
    });
    if (colums.length !== columIds.length) {
      throw new BadRequestException("유효하지 않은 요청입니다.");
    }

    for (let element of colums) {
      if (element.board_id !== board_id) {
        throw new BadRequestException("유효하지 않은 요청입니다.");
      }
    }

    const ordersMap = columIds.reduce((map, id, index) => {
      map[id] = index + 1;
      return map;
    }, {});

    await Promise.all(
      colums.map((colum) => {
        colum.columOrder = ordersMap[colum.id];
        return this.columRepository.save(colum);
      }),
    );
  }

  ////////////////////////////////////////////////////////////
}
