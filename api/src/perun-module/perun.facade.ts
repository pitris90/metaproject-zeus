import { Injectable } from '@nestjs/common';
import { PerunGroupService } from './services/perun-group.service';
import { Group } from './entities/group.entity';

@Injectable()
export class PerunFacade {
	constructor(private readonly perunGroupService: PerunGroupService) {}

	async createGroup(title: string, description: string): Promise<Group> {
		return this.perunGroupService.createGroup(title, description);
	}
}
