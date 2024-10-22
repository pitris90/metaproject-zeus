import { Controller, Get } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AttributeTypeService } from '../services/attribute-type.service';
import { ProjectNotFoundApiException } from '../../error-module/errors/projects/project-not-found.api-exception';
import { MinRoleCheck } from '../../permission-module/decorators/min-role.decorator';
import { RoleEnum } from '../../permission-module/models/role.enum';
import { AttributeTypeDto } from '../dtos/attribute-type.dto';

@ApiTags('Attribute')
@Controller('/attribute-type')
export class AttributeTypeController {
	constructor(private readonly attributeTypeService: AttributeTypeService) {}

	@Get('/')
	@MinRoleCheck(RoleEnum.USER)
	@ApiOperation({
		summary: 'Get attribute types',
		description: 'Get defined attribute types.'
	})
	@ApiOkResponse({
		description: 'Attribute types in the system.',
		type: [AttributeTypeDto]
	})
	@ApiNotFoundResponse({
		description: 'Project not found or user has no access to this project.',
		type: ProjectNotFoundApiException
	})
	async getAttributeTypes() {
		return this.attributeTypeService.getAttributeTypes();
	}
}
