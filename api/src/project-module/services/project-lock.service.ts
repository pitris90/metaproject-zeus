import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

@Injectable()
export class ProjectLockService {
	/**
	 * This methods needs to be called from transaction
	 *
	 * @param manager
	 * @param projectId
	 */
	public async lockProject(manager: EntityManager, projectId: number) {
		await manager.query('SELECT * FROM project WHERE id = $1 FOR UPDATE', [projectId]);
	}
}
