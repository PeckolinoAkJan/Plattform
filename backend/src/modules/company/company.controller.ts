import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CompanyService } from "./company.service";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { ApplyCompanyDto } from "./dto/apply-company.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, type CurrentUserValue } from "../../common/decorators/current-user.decorator";

@Controller("company")
@UseGuards(JwtAuthGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  async getCurrentCompany(@CurrentUser() user: CurrentUserValue) {
    return this.companyService.getCurrentCompany(user.userId);
  }

  @Patch()
  async updateCurrentCompany(
    @CurrentUser() user: CurrentUserValue,
    @Body() body: UpdateCompanyDto,
  ) {
    return this.companyService.updateCurrentCompany(user.userId, body);
  }

  @Post("create")
  async createCompany(
    @CurrentUser() user: CurrentUserValue,
    @Body() createCompanyDto: CreateCompanyDto,
  ) {
    return this.companyService.createCompany(user.userId, createCompanyDto);
  }

  @Post(":id/apply")
  async applyToCompany(
    @CurrentUser() user: CurrentUserValue,
    @Param("id") id: string,
    @Body() applyCompanyDto: ApplyCompanyDto,
  ) {
    return this.companyService.applyToCompany(user.userId, id, applyCompanyDto);
  }

  @Patch("application/:id")
  async processApplication(
    @CurrentUser() user: CurrentUserValue,
    @Param("id") id: string,
    @Body() body: { accept: boolean },
  ) {
    return this.companyService.processApplication(user.userId, id, body.accept);
  }

  @Patch(":companyId/members/:memberId/role")
  async updateMemberRole(
    @CurrentUser() user: CurrentUserValue,
    @Param("companyId") companyId: string,
    @Param("memberId") memberId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.companyService.updateMemberRole(user.userId, memberId, companyId, dto);
  }

  @Get(":id")
  async getProfile(@Param("id") id: string) {
    return this.companyService.getCompanyProfile(id);
  }
}
