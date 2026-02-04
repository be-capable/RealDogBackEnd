import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Req,
  UnauthorizedException,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { ApiHeaders, ApiOperation, ApiParam, ApiTags, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { APP_HEADERS } from '../common/swagger/app-headers';
import { Request } from 'express';
import { AtGuard } from '../auth/common/guards/at.guard';

@ApiTags('Users')
@ApiHeaders(APP_HEADERS)
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create User', description: 'Create a new user profile. (Admin only)' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({ summary: 'List Users', description: 'Retrieve all users. (Admin only)' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get('account')
  @ApiOperation({
    summary: 'Get Current User',
    description: 'Get the currently authenticated user profile.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current user profile',
  })
  async getCurrentUser(@Req() req: Request) {
    const user = (req as any).user;
    
    if (!user) {
      throw new UnauthorizedException({
        message: 'Token missing or invalid',
        code: 'TOKEN_INVALID'
      });
    }

    const userId = user.sub || user.userId || user.id;
    if (!userId) {
      throw new UnauthorizedException({
        message: 'Invalid token payload',
        code: 'TOKEN_INVALID'
      });
    }

    const dbUser = await this.usersService.findOne(Number(userId));
    if (!dbUser) {
      throw new UnauthorizedException({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    return dbUser;
  }

  @Delete('account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete Account',
    description: 'Delete user account and all associated data (GDPR right to erasure).',
  })
  @ApiResponse({
    status: 200,
    description: 'Account and all data successfully deleted',
  })
  async deleteAccount(@Req() req: Request) {
    const user = (req as any).user;
    if (!user) throw new UnauthorizedException();
    const userId = user.sub || user.userId || user.id;
    return await this.usersService.remove(Number(userId));
  }

  @Get('account/export')
  @ApiOperation({
    summary: 'Export Account Data',
    description: 'Export all user data in machine-readable format (GDPR right to data portability).',
  })
  @ApiResponse({
    status: 200,
    description: 'User data exported successfully',
  })
  async exportAccountData(@Req() req: Request) {
    const user = (req as any).user;
    if (!user) throw new UnauthorizedException();
    const userId = user.sub || user.userId || user.id;
    return await this.usersService.exportUserData(Number(userId));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get User', description: 'Retrieve user details by ID.' })
  @ApiParam({ name: 'id', description: 'User ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update User', description: 'Update user details.' })
  @ApiParam({ name: 'id', description: 'User ID' })
  update(@Req() req: Request, @Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    const user = (req as any).user;
    if (!user) throw new UnauthorizedException();
    const userId = user.sub || user.userId || user.id;
    
    if (Number(userId) !== +id) {
      throw new ForbiddenException('Cannot update other users profile');
    }
    return this.usersService.update(+id, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete User', description: 'Remove a user. (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }
}
