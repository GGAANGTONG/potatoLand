import { IsNotEmpty, IsString, IsStrongPassword } from "class-validator";
import { Board } from "../../board/entities/board.entity";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Index("email", ["email"], { unique: true })
@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * 이메일
   * @example "gookbab99@gmail.com"
   */
  @IsNotEmpty({ message: "이메일을 입력해 주세요." })
  @IsString()
  @Column({ type: "varchar", unique: true, nullable: false })
  email: string;

  /**
   * 비밀번호
   * @example "Ex@mple!!123"
   */
  @IsStrongPassword(
    {},
    {
      message:
        "비밀번호는 영문 알파벳 대,소문자, 숫자, 특수문자(!@#$%^&*)를 포함해야 합니다.",
    },
  )
  @Column({ type: "varchar", select: false, nullable: false })
  password: string;

  /**
   * 이름
   * @example "국밥"
   */
  @IsNotEmpty({ message: "이름을 입력해 주세요." })
  @IsString()
  @Column({ type: "varchar", nullable: false })
  name: string;

  /**
   * 사용자 프로필 이미지
   * @example https://cdn.ulsanpress.net/news/photo/202108/382677_166224_2914.jpg
   */
  @Column({ type: "varchar", nullable: true })
  image: string;

  @Column({ type: "varchar", nullable: true })
  imageKey: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: "boolean", nullable: false })
  emailYn: boolean;

  @Column({ type: "varchar", nullable: false })
  emailYnCode: string;

  @OneToMany(() => Board, (Board) => Board.createdBy)
  boards: Board[];
}
