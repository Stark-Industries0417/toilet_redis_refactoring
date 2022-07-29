import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Connection } from 'typeorm';
import { UserRegisterDto } from '../dtos/user.register.dto';
import { UserEntity } from '../users.entity';
import * as bcrypt from 'bcrypt';
import { UserResponseDto } from '../dtos/user.response.dto';
import { ConflictException } from '@nestjs/common';
import { UserEditNicknameInputDto } from '../dtos/user.modify.nickname.dto';
import { UserModifyPasswordDto } from '../dtos/user.modifyPassword.dto';
import { UserEmailDto } from '../dtos/user.email.dto';
import { query } from 'express';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    private readonly connection: Connection,
  ) {}

  private readonly userFilter = (user: UserEntity): UserResponseDto => ({
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    imgUrl: user.imgUrl,
  });

  async signUp(
    userRegisterDto: UserRegisterDto,
    userImg: string,
  ): Promise<UserResponseDto> {
    const { email, password, checkPassword, nickname } = userRegisterDto;
    const hasEmail = await this.usersRepository.findOne({ email });
    const hasNickname = await this.usersRepository.findOne({ nickname });
    if (hasEmail) {
      throw new ConflictException('이미 가입된 이메일 입니다.');
    }

    if (password !== checkPassword) {
      throw new ConflictException('비밀번호가 일치하지 않습니다.');
    }

    if (hasNickname) {
      throw new ConflictException('이미 사용중인 닉네임 입니다.');
    }
    const imgUrl = userImg;
    const hashedPassword = await bcrypt.hash(password, 10);

    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = queryRunner.manager
        .getRepository(UserEntity)
        .create({ email, password: hashedPassword, nickname, imgUrl });
      await queryRunner.manager.getRepository(UserEntity).save(user);
      await queryRunner.commitTransaction();
      return this.userFilter(user);
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException(e.message);
    } finally {
      await queryRunner.release();
    }
  }

  async checkEmail(userEmailDto: UserEmailDto) {
    try {
      const hasEmail = await this.usersRepository.findOne({
        where: userEmailDto,
      });
      if (hasEmail) throw new ConflictException('이미 가입된 이메일 입니다.');
      return '가입 가능한 이메일 입니다.';
    } catch (err) {
      throw new ConflictException(err.message);
    }
  }

  async modifyNickname(
    user: UserEntity,
    { nickname }: UserEditNicknameInputDto,
  ) {
    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const findNickname = await queryRunner.manager
        .getRepository(UserEntity)
        .findOne({ where: { nickname } });

      if (findNickname)
        throw new ConflictException('이미 사용중인 닉네임 입니다.');

      user.nickname = nickname;
      await queryRunner.manager.getRepository(UserEntity).save(user);
      await queryRunner.commitTransaction();
      return this.userFilter(user);
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException(e.message);
    } finally {
      await queryRunner.release();
    }
  }

  async modifyUserImg(
    userInfo: UserEntity,
    modifyImg: string,
  ): Promise<UserResponseDto> {
    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      userInfo.imgUrl = modifyImg;
      await queryRunner.manager.getRepository(UserEntity).save(userInfo);
      await queryRunner.commitTransaction();
      return this.userFilter(userInfo);
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException(e.message);
    } finally {
      await queryRunner.release();
    }
  }

  async modifyPassword(
    userModifyPasswordDto: UserModifyPasswordDto,
    email: UserEmailDto,
    user?: UserEntity,
  ) {
    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const { existPassword, password, checkPassword } = userModifyPasswordDto;
    try {
      const userInfo = await queryRunner.manager
        .getRepository(UserEntity)
        .findOne(user ? user : email);
      const samePassword = await bcrypt.compare(password, userInfo.password);
      if (samePassword) {
        return '기존 비밀번호와 같습니다.';
      }

      if (existPassword) {
        const validatePassword = await bcrypt.compare(
          existPassword,
          userInfo.password,
        );
        if (!validatePassword)
          throw new ConflictException('비밀번호가 틀렸습니다.');
      }
      if (password !== checkPassword)
        throw new ConflictException('비밀번호가 일치하지 않습니다.');
      const hashedPassword = await bcrypt.hash(password, 10);

      userInfo.password = hashedPassword;
      await queryRunner.manager.getRepository(UserEntity).save(userInfo);
      await queryRunner.commitTransaction();
      return this.userFilter(userInfo);
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException(e.message);
    } finally {
      await queryRunner.release();
    }
  }

  async userWithdrawal(userInfo: UserEntity) {
    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.getRepository(UserEntity).remove(userInfo);
      await queryRunner.commitTransaction();
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException(e.message);
    } finally {
      await queryRunner.release();
    }
  }
}
