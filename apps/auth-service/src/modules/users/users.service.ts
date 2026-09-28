import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import UserEntity from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import CreateUserDto from './dto/create-user.dto';
import { PasswordResetTokenOptions } from './users.interface';
import UpdateUserDto from './dto/update-user.dto';
import ListUsersQueryDto from './dto/list-users-query.dto';

@Injectable()
class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async findAll(query: ListUsersQueryDto) {
    const { page, limit, sortBy, sortOrder } = query;

    const [items, total] = await this.userRepository.findAndCount({
      where: this.prepareListWhere(query),
      order: {
        [sortBy]: sortOrder,
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return this.buildPaginationResponse(items, total, page, limit);
  }

  async create(dto: CreateUserDto): Promise<UserEntity> {
    const existingUser = await this.userRepository.findOne({
      where: {
        email: dto.email,
      },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const user = this.userRepository.create(dto);

    return this.userRepository.save(user);
  }

  async update(id: number, dto: UpdateUserDto) {
    const user = await this.userRepository.preload({ id, ...dto });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.userRepository.save(user);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepository.findOneBy({ email });
  }

  async findByEmailOrFail(email: string): Promise<UserEntity> {
    const user = await this.findByEmail(email);
    if (!user)
      throw new NotFoundException(`User with email ${email} not found`);
    return user;
  }

  async findById(id: number): Promise<UserEntity | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByIdOrFail(id: number): Promise<UserEntity> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);
    return user;
  }

  async findByIdWithPassword(id: number): Promise<UserEntity> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        tokenVersion: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async remove(id: number): Promise<UserEntity> {
    const user = await this.findByIdOrFail(id);

    await this.userRepository.remove(user);

    return user;
  }

  async setActive(id: number, isActive: boolean): Promise<void> {
    const result = await this.userRepository.update({ id }, { isActive });

    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async incrementTokenVersion(id: number): Promise<void> {
    const result = await this.userRepository.increment(
      { id },
      'tokenVersion',
      1,
    );

    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async setPasswordResetToken(
    id: number,
    options: PasswordResetTokenOptions,
  ): Promise<void> {
    const { tokenHash, expiresAt } = options;

    const result = await this.userRepository.update(
      { id },
      { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt },
    );

    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async findByValidResetToken(tokenHash: string): Promise<UserEntity | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordResetTokenHash')
      .addSelect('user.passwordResetExpiresAt')
      .where('user.passwordResetTokenHash = :tokenHash', { tokenHash })
      .andWhere('user.passwordResetExpiresAt > CURRENT_TIMESTAMP')
      .getOne();
  }

  async clearPasswordResetToken(id: number): Promise<void> {
    const result = await this.userRepository.update(
      { id },
      { passwordResetTokenHash: null, passwordResetExpiresAt: null },
    );

    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async resetPassword(id: number, hashedPassword: string): Promise<void> {
    const result = await this.userRepository.update(
      { id },
      {
        password: hashedPassword,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        tokenVersion: () => 'tokenVersion + 1',
      },
    );

    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async changePassword(id: number, hashedPassword: string): Promise<void> {
    const result = await this.userRepository.update(
      { id },
      {
        password: hashedPassword,
        tokenVersion: () => 'tokenVersion + 1',
      },
    );

    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  private prepareListWhere(
    query: ListUsersQueryDto,
  ): FindOptionsWhere<UserEntity>[] {
    const { search, role, isActive } = query;

    const baseWhere: FindOptionsWhere<UserEntity> = {};

    if (role !== undefined) {
      baseWhere.role = role;
    }

    if (isActive !== undefined) {
      baseWhere.isActive = isActive;
    }

    if (!search) {
      return [baseWhere];
    }

    const searchPattern = `%${search.trim()}%`;

    return [
      {
        ...baseWhere,
        firstName: ILike(searchPattern),
      },
      {
        ...baseWhere,
        lastName: ILike(searchPattern),
      },
      {
        ...baseWhere,
        email: ILike(searchPattern),
      },
    ];
  }

  private buildPaginationResponse(
    items: UserEntity[],
    total: number,
    page: number,
    limit: number,
  ) {
    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }
}

export default UsersService;
