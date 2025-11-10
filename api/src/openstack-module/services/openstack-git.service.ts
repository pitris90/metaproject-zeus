import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Gitlab } from '@gitbeaker/rest';
import { simpleGit, SimpleGit } from 'simple-git';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AppService } from '../../app.service';

interface CommitAndMergeRequestParams {
	projectSlug: string;
	domain: string;
	yamlContent: string;
	mergeRequestTitle: string;
	mergeRequestDescription: string;
	projectDisplayName: string;
}

interface CommitAndMergeRequestResult {
	branch: string;
	filePath: string;
	mergeRequestUrl: string;
}

@Injectable()
export class OpenstackGitService {
	private readonly logger = new Logger(OpenstackGitService.name);

	constructor(private readonly configService: ConfigService) {}

	public async commitAndOpenMergeRequest(
		params: CommitAndMergeRequestParams
	): Promise<CommitAndMergeRequestResult> {
		const repoPath = this.resolveRepositoryPath();
		const baseBranch = this.configService.get<string>('OPENSTACK_GIT_BASE_BRANCH') ?? 'master';
		const targetBranch = this.configService.get<string>('OPENSTACK_GIT_TARGET_BRANCH') ?? 'master';
		const gitAuthorName = this.configService.get<string>('OPENSTACK_GIT_AUTHOR_NAME') ?? 'Zeus Bot';
		const gitAuthorEmail =
			this.configService.get<string>('OPENSTACK_GIT_AUTHOR_EMAIL') ?? 'zeus-bot@example.com';

		const gitlab = this.instantiateGitlabClient();
		const projectId = this.resolveGitlabProjectId();

		await fs.promises.mkdir(repoPath, { recursive: true });
		if (!fs.existsSync(path.join(repoPath, '.git'))) {
			throw new InternalServerErrorException(
				`OpenStack repository is not initialized as a Git repository at path "${repoPath}".`
			);
		}
		const git = simpleGit(repoPath);

		await git.fetch();
		await git.checkout(baseBranch);
		await git.pull('origin', baseBranch);

		const branchName = await this.prepareBranch(git, params.projectSlug, baseBranch);

		const filePath = await this.writeYamlFile(repoPath, params.domain, params.projectSlug, params.yamlContent);
		const relativeFilePath = path.relative(repoPath, filePath);

		await git.add(relativeFilePath);

		const status = await git.status();
		if (status.isClean()) {
			this.logger.warn(
				`OpenStack repository has no changes for project "${params.projectDisplayName}". Skipping commit.`
			);
		} else {
			await git.commit(`feat: openstack allocation for ${params.projectDisplayName}`, undefined, {
				'--author': `${gitAuthorName} <${gitAuthorEmail}>`
			});
		}

		await git.push(['-u', 'origin', branchName]);

		const mergeRequest = await this.ensureMergeRequest(
			gitlab,
			projectId,
			branchName,
			targetBranch,
			params.mergeRequestTitle,
			params.mergeRequestDescription
		);

		return {
			branch: branchName,
			filePath: relativeFilePath,
			mergeRequestUrl: mergeRequest.web_url
		};
	}

	private resolveRepositoryPath(): string {
		const configuredPath = this.configService.get<string>('OPENSTACK_REPO_PATH');
		if (configuredPath) {
			return configuredPath;
		}

		const appRoot = AppService.APP_ROOT ?? path.resolve(__dirname, '..', '..', '..');
		return path.join(appRoot, 'src', 'openstack-module', 'openstack-external');
	}

	private resolveGitlabProjectId(): number {
		const raw = this.configService.get<string>('OPENSTACK_GITLAB_PROJECT_ID');
		if (!raw) {
			throw new InternalServerErrorException('OPENSTACK_GITLAB_PROJECT_ID is not configured.');
		}

		const parsed = Number(raw);
		if (Number.isNaN(parsed)) {
			throw new InternalServerErrorException('OPENSTACK_GITLAB_PROJECT_ID must be a number.');
		}

		return parsed;
	}

	private instantiateGitlabClient(): Gitlab {
		const host = this.configService.get<string>('OPENSTACK_GITLAB_HOST');
		const token = this.configService.get<string>('OPENSTACK_GITLAB_TOKEN');

		if (!host || !token) {
			throw new InternalServerErrorException(
				'OPENSTACK_GITLAB_HOST and OPENSTACK_GITLAB_TOKEN must be configured for OpenStack integration.'
			);
		}

		return new Gitlab({ host, token });
	}

	private async prepareBranch(git: SimpleGit, projectSlug: string, baseBranch: string): Promise<string> {
		const base = this.sanitizeBranchName(projectSlug);

		const conflicts = new Set<string>();
		const localBranches = await git.branchLocal();
		localBranches.all.forEach((branch) => conflicts.add(branch));

		const remoteBranches = await git.branch(['-r']);
		remoteBranches.all
			.map((branch) => branch.replace(/^origin\//, ''))
			.map((branch) => branch.split(' -> ')[0])
			.forEach((branch) => conflicts.add(branch));

		let candidate = base;
		let suffix = 0;
		while (conflicts.has(candidate)) {
			suffix += 1;
			candidate = `${base}-${suffix}`;
		}

		await git.checkoutLocalBranch(candidate);
		return candidate;
	}

	private sanitizeBranchName(branch: string): string {
		const trimmed = branch.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
		const cleaned = trimmed.replace(/-+/g, '-').replace(/^-|-$/g, '');
		const slug = cleaned.length > 0 ? cleaned : 'allocation';
		return `openstack/${slug}`;
	}

	private async writeYamlFile(
		repoPath: string,
		domain: string,
		projectSlug: string,
		yamlContent: string
	): Promise<string> {
		const baseDirectory = path.join(
			repoPath,
			'environments',
			'prod-brno',
			'openstack',
			'projects-quotas-acls',
			domain
		);

		await fs.promises.mkdir(baseDirectory, { recursive: true });

		const targetFile = path.join(baseDirectory, `${projectSlug}.yaml`);
		await fs.promises.writeFile(targetFile, yamlContent, 'utf8');

		return targetFile;
	}

	private async ensureMergeRequest(
		gitlab: Gitlab,
		projectId: number,
		sourceBranch: string,
		targetBranch: string,
		title: string,
		description: string
	) {
		const existing = await gitlab.MergeRequests.all({
			projectId,
			sourceBranch,
			state: 'opened'
		});

		if (existing.length > 0) {
			this.logger.log(
				`Reusing existing OpenStack merge request #${existing[0].iid} for branch "${sourceBranch}".`
			);
			return existing[0];
		}

		return gitlab.MergeRequests.create(projectId, sourceBranch, targetBranch, title, {
			description
		});
	}
}
