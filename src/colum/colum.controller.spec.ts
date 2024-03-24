import { Test, TestingModule } from "@nestjs/testing";
import { ColumController } from "./colum.controller";
import { ColumService } from "./colum.service";
import { CreateColumDto } from "./dto/createColum.dto";
import { Colum } from "./entities/colum.entity";
import { BadRequestException, HttpStatus } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { UpdateColumDto } from "./dto/updateColum.dto";
import { RemoveColumDto } from "./dto/removeColum.dto";
import { ReorderColumDto } from "./dto/reorderColum.dto";

describe("ColumController", () => {
  let columController: ColumController;

  let columService = {
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    reorderColum: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ColumController],
      providers: [
        ColumService,
        {
          provide: ColumService,
          useValue: columService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
      ],
    }).compile();

    columController = module.get<ColumController>(ColumController);
  });

  it("should be defined", () => {
    expect(columController).toBeDefined();
  });

  it("create => should create a new colum by given data", async () => {
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

    columService.create.mockResolvedValue(colum);

    const result = await columController.create(createColumDto);

    expect(columService.create).toHaveBeenCalledWith(createColumDto);
    expect(result).toEqual({
      statusCode: HttpStatus.CREATED,
      message: "컬럼이 생성되었습니다.",
      data: colum,
    });
  });

  it("update => should update a specified colum by given data", async () => {
    const updateColumDto = {
      board_id: 1,
      id: 1,
      title: "updated test",
    } as UpdateColumDto;

    const colum = {
      id: 1,
      columOrder: 1,
      title: "updated test",
      createdAt: new Date(),
      updatedAt: new Date(),
      card: [],
      board_id: 1,
    } as Colum;

    columService.update.mockResolvedValue(colum); // metadata?

    const result = await columController.update(updateColumDto);

    expect(columService.update).toHaveBeenCalledWith(updateColumDto);
    expect(result).toEqual({
      statusCode: HttpStatus.CREATED,
      message: "컬럼 이름이 수정되었습니다.",
    });
  });

  it("remove => should remove a specified column by given data", async () => {
    const removeColumDto = {
      id: 1,
    } as RemoveColumDto;

    const result = await columController.remove(removeColumDto);

    expect(columController.remove).toHaveBeenCalledWith(removeColumDto);
    expect(result).toEqual({
      statusCode: HttpStatus.OK,
      message: "컬럼이 삭제되었습니다.",
    });
  });

  // it("reorder => should reorder a specified column by given data", async () => {
  //   const reorderColumDto = {
  //     columIds: [1, 2],
  //     board_id: 1
  //   } as ReorderColumDto;

  //   //columService.reorderColum.mockResolvedValue()

  //   const result = await columController.reorderColum(reorderColumDto);

  //   expect(columController.reorderColum).toHaveBeenCalledWith(reorderColumDto);
  //   expect(result).toEqual({
  //     statusCode: HttpStatus.OK,
  //     message: "컬럼 순서가 변경되었습니다.",
  //     data:
  //   });
  // });
});
