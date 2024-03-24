import { Test, TestingModule } from "@nestjs/testing";
import { ColumService } from "./colum.service";
import { Repository } from "typeorm";
import { Colum } from "./entities/colum.entity";
import { getRepositoryToken } from "@nestjs/typeorm";
import { CreateColumDto } from "./dto/createColum.dto";

describe("ColumService", () => {
  let columService: ColumService;
  let columRepository: Partial<Record<keyof Repository<Colum>, jest.Mock>>;

  beforeEach(async () => {
    columRepository = {
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      findOneBy: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ColumService,
        {
          provide: getRepositoryToken(Colum),
          useValue: columRepository,
        },
      ],
    }).compile();

    columService = module.get<ColumService>(ColumService);
  });
  
  describe("create test", () => {
    it("should create a column if given createColumDto", async () => {
      const createColumDto = {
        columOrder: 1,
        title: "test",
        board_id: 1,
      } as CreateColumDto;

      const colum = {
        id: 1,
        columOrder: 1,
        title: "test",
        createdAt: new Date(),
        updatedAt: new Date(),
        card: [],
        board_id: 1,
      } as Colum;
      
      const user = {
        id: 1,
        email: 'gookbab99@gmail.com',
        password: 'Ex@mple!!123',
        name: '국밥',
        image: '국밥은 맛있다',
        imageKey: '맛있는 국밥',
        created_at: new Date(),
        updated_at: new Date(),
        emailYn: true,
        emailYnCode: '0612a8',
        boards: []
      }

      columRepository.save.mockResolvedValue(colum);

      // act
      const result = await columService.create(user, createColumDto);

      // assert
      expect(columRepository.save).toHaveBeenCalled();
      expect(columRepository.save).toHaveBeenCalledWith(createColumDto);
      expect(result).toEqual(colum);
    });
  });
});
