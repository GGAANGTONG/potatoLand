import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Card } from "./entities/card.entity";
import { Working } from "./entities/working.entity";
import { User } from "src/user/entity/user.entity";
import { Board } from "src/board/entities/board.entity";
import { Colum } from "src/colum/entities/colum.entity";
import { In, Repository } from "typeorm";
import {
  CreateCardDto,
  CardDetailsDto,
  UpdateCardDto,
  ReorderCardsDto,
  MoveCardDto,
} from "./dto/card.dto";
import _ from "lodash";

@Injectable()
export class CardService {
  constructor(
    @InjectRepository(Card)
    private readonly cardRepository: Repository<Card>,
    @InjectRepository(Working)
    private readonly worker_Repository: Repository<Working>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Board)
    private readonly boardRepository: Repository<Board>,
    @InjectRepository(Colum)
    private readonly columRepository: Repository<Colum>,
  ) {}

  async createCard(user: User, boardId: number, createCardDto: CreateCardDto) {
    const { cardOrder, colum_id, title, desc, color } = createCardDto;
    const userId = user.id;
    const isMember = await this.isMemberOfBoard(userId, boardId);

    if (!isMember) {
      throw new ForbiddenException("해당 보드의 멤버가 아닙니다.");
    }

    const newCard = this.cardRepository.create({
      colum_id,
      cardOrder: cardOrder,
      title: title,
      desc: desc,
      color: color,
    });
    return this.cardRepository.save(newCard);
  }

  async getCards(): Promise<Card[]> {
    const cards = this.cardRepository.find();
    return cards;
  }

  async getCardDetails(cardId: number): Promise<CardDetailsDto> {
    const card = await this.cardRepository.findOne({
      where: {
        id: cardId,
      },
    });

    if (!card) {
      throw new NotFoundException("Card not found");
    }

    const cardDetails: CardDetailsDto = {
      cardOrder: card.cardOrder,
      colum_id: card.colum_id,
      title: card.title,
      desc: card.desc,
      color: card.color,
      id: card.id,
      comments: card.comments,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    };

    return cardDetails;
  }

  async reorderCards(
    user: User,
    boardId: number,
    reorderCardsDto: ReorderCardsDto,
  ): Promise<void> {
    const userId = user.id;
    const isMember = await this.isMemberOfBoard(userId, boardId);

    if (!isMember) {
      throw new ForbiddenException("해당 보드의 멤버가 아닙니다.");
    }
    const { cardIds } = reorderCardsDto;
    const cards = await this.cardRepository.find({
      where: {
        id: In(cardIds),
      },
    });
    if (cards.length !== cardIds.length) {
      throw new NotFoundException("해당 Id의 카드를 찾을 수 없습니다.");
    }
    const ordersMap = cardIds.reduce((map, id, index) => {
      map[id] = index + 1;
      return map;
    }, {});
    await Promise.all(
      cards.map((card) => {
        card.cardOrder = ordersMap[card.id];
        return this.cardRepository.save(card);
      }),
    );
  }

  async updateCard(
    user: User,
    boardId: number,
    updateCardDto: UpdateCardDto,
    cardId: number,
  ) {
    const userId = user.id;
    const isMember = await this.isMemberOfBoard(userId, boardId);

    if (!isMember) {
      throw new ForbiddenException("해당 보드의 멤버가 아닙니다.");
    }
    const { title, desc, color } = updateCardDto;
    const card = await this.cardRepository.findOne({
      where: {
        id: cardId,
      },
    });

    if (!card) {
      throw new NotFoundException("카드를 찾을 수 없습니다.");
    }

    card.title = title ? title : card.title;
    card.desc = desc ? desc : card.desc;
    card.color = color ? color : card.color;

    return this.cardRepository.save(card);
  }

  async createCardWorker_(
    user: User,
    boardId: number,
    cardId: number,
    UserId: number,
  ): Promise<void> {
    const userId = user.id;
    const isMember = await this.isMemberOfBoard(userId, boardId);

    if (!isMember) {
      throw new ForbiddenException("해당 보드의 멤버가 아닙니다.");
    }
    const card = await this.cardRepository.findOne({
      where: {
        id: cardId,
      },
    });

    const worker_user = await this.userRepository.findOne({
      where: {
        id: UserId,
      },
    });

    if (!card || !worker_user) {
      throw new NotFoundException("유저 또는 카드를 찾을 수 없습니다.");
    }

    const worker_ = this.worker_Repository.create({
      card,
      user: worker_user,
    });

    await this.worker_Repository.save(worker_);
  }

  async removeCardWorker_(
    user: User,
    boardId: number,
    cardId: number,
    workerId: number,
  ): Promise<void> {
    const userId = user.id;
    const isMember = await this.isMemberOfBoard(userId, boardId);

    if (!isMember) {
      throw new ForbiddenException("해당 보드의 멤버가 아닙니다.");
    }
    await this.worker_Repository.delete({
      card: { id: cardId },
      user: { id: workerId },
    });
  }

  async deleteCard(user: User, boardId: number, cardId: number): Promise<void> {
    const userId = user.id;
    const isMember = await this.isMemberOfBoard(userId, boardId);

    if (!isMember) {
      throw new ForbiddenException("해당 보드의 멤버가 아닙니다.");
    }
    await this.cardRepository.delete(cardId);
  }

  async moveCard(
    user: User,
    boardId: number,
    moveCardDto: MoveCardDto,
  ): Promise<void> {
    const { cardId, newColumId } = moveCardDto;
    const userId = user.id;
    const isMember = await this.isMemberOfBoard(userId, boardId);
    if (!isMember) {
      throw new ForbiddenException("해당 보드의 멤버가 아닙니다.");
    }
    const card = await this.cardRepository.findOne({
      where: {
        id: cardId,
      },
    });

    if (!card) {
      throw new NotFoundException("Card not found");
    }

    const newColum = await this.columRepository.findOne({
      where: {
        id: newColumId,
      },
    });

    if (!newColum) {
      throw new NotFoundException("Target list not found");
    }

    card.colum = newColum;

    this.cardRepository.save(card);
  }
  //   card.colum_id = colum_id

  //   const relocatedCard = await this.cardRepository.save(card)

  //   return relocatedCard
  //  }

  //  async moveCard({id, colum_id}: MoveCardDto) {
  //   console.log(id, colum_id)
  //   const card = await this.cardRepository.findOne({
  //     where: {
  //       id

  //     }
  //   })

  //   console.log('card?', card)
  //   if(_.isNil(card)) {
  //     throw new BadRequestException('유효하지 않은 요청입니다.')
  //   }

  async scheduleCard(user: User, boardId: number, {id, colum_id, deadline}) {
    const {id: userId} = user 
    const isMember = await this.isMemberOfBoard(userId, boardId);

    if(_.isNil(isMember)) {
      throw new UnauthorizedException('인가되지 않은 권한입니다.')
    }

    const scheduled = await this.cardRepository.save({id, colum_id, deadline})

    return scheduled
  }

  ////////////////////////////////////privatefunction///////////////////////////////////////
  private async isMemberOfBoard(
    userId: number,
    boardId: number,
  ): Promise<boolean> {
    const board = await this.boardRepository
      .createQueryBuilder("board")
      .innerJoinAndSelect("board.members", "members")
      .innerJoinAndSelect("members.user", "user")
      .where("board.id = :boardId", { boardId })
      .getOne();

    if (!board) {
      return false;
    }
    return board.members.some((member) => member.user.id === userId);
  }
}
