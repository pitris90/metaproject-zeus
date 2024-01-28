import { Test, TestingModule } from '@nestjs/testing';
import { Type } from '@nestjs/common/interfaces/type.interface';
import { DynamicModule } from '@nestjs/common/interfaces/modules/dynamic-module.interface';
import { ForwardReference } from '@nestjs/common/interfaces/modules/forward-reference.interface';
import { TypeormConfigService } from 'resource-manager-database';
import { TypeormE2EConfigService } from './database-e2e';

export const createTestingModule = (
	imports: Array<Type | DynamicModule | Promise<DynamicModule> | ForwardReference>
): Promise<TestingModule> => {
	return Test.createTestingModule({
		imports: imports
	})
		.overrideProvider(TypeormConfigService)
		.useValue(new TypeormE2EConfigService())
		.compile();
};
