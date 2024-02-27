import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { Project, ProjectStatus, User } from 'resource-manager-database';
import { RequestProjectDto } from '../dtos/request-project.dto';
import { ProjectDto } from '../dtos/project.dto';
import { ProjectMapper } from './project.mapper';

@Injectable()
export class ProjectService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly projectMapper: ProjectMapper
	) {}

	async getUserProjects(piId: number): Promise<ProjectDto[]> {
		const projects = await this.dataSource
			.createQueryBuilder(Project, 'project')
			.innerJoinAndSelect('project.pi', 'pi')
			.where('pi.id = :piId', { piId })
			.getMany();

		return projects.map((project) =>
			this.projectMapper.toProjectDto(project.id, project.title, project.description, project.status, project.pi)
		);
	}

	async requestProject(requestProjectDto: RequestProjectDto, piId: number): Promise<ProjectDto> {
		return this.dataSource.transaction(async (manager) => {
			const userRepository = manager.getRepository(User);

			const user = await userRepository.findOneByOrFail({
				id: piId
			});

			const status = ProjectStatus.NEW;
			try {
				const result = await manager
					.createQueryBuilder()
					.insert()
					.into(Project)
					.values({
						title: requestProjectDto.title,
						description: requestProjectDto.description,
						status,
						pi: user
					})
					.execute();

				return this.projectMapper.toProjectDto(
					result.identifiers[0]['id'],
					requestProjectDto.title,
					requestProjectDto.description,
					status,
					user
				);
			} catch (e) {
				if (
					e instanceof QueryFailedError &&
					e.message.includes('duplicate key value violates unique constraint')
				) {
					// TODO edit when error module is created
					throw new ConflictException('Project request exists');
				}

				throw e;
			}
		});
	}
}
