import { memo, useContext, useEffect, useState } from 'react';
import StoryProvider from '../storyProvider/storyProvider';
import { CodeDaemonState } from '../../state-managers/code-daemon/code-daemon-types';
import { StoryState } from '../../state-managers/story/story.store';
import { Edge, Node } from 'reactflow';
import { EdgeData } from '../base/edge/edge-data.model';
import { Bootloader } from '../../services/bootloader/bootloader.service';
import { LoadingOverlay } from '@mantine/core';
import { HostContext } from '../../state-managers/host/host.store';
import { useCommands } from '../../commands/use-command.hook';
import { NodeData } from '../reactflow/models';
import { StoreApi } from 'zustand';
import { PlaygroundViewFlags } from '../../ui-types';
import ErrorRenderer from '../error-renderer';

type BootState =
	| {
			state: 'loading';
	  }
	| {
			state: 'loaded';
	  }
	| {
			state: 'errored';
			error: Error;
	  };

export default memo(function StoryProviderFactory(props: {
	projectName: string;
	namespace: string;
	build: CodeDaemonState['build'] & { state: 'built' };
	story: StoreApi<StoryState>;
	height?: string;
	viewFlags?: PlaygroundViewFlags;
}) {
	const { build } = props;
	const hostStore = useContext(HostContext);
	if (!hostStore) {
		throw new Error('SPF not under host context!');
	}
	const bootLoader = new Bootloader(
		props.story.getState().runtime,
		props.projectName,
		props.story.getState().id,
		build
	);
	const [bootState, setBootState] = useState<BootState>({
		state: 'loading',
	});

	const {
		stories: { hydrateStoryScriptFromStore },
	} = useCommands();

	useEffect(() => {
		(async () => {
			const { nodes, edges } = await bootLoader.boot();
			hydrateStoryScriptFromStore(props.story.getState().id);
			props.story.setState({
				nodes,
				edges,
			});
			await props.story
				.getState()
				.setResolutionAndRefreshPrimordials(props.story.getState().resolution);

			setBootState({
				state: 'loaded',
			});
		})().catch((error) => {
			setBootState({
				state: 'errored',
				error,
			});
		});
	}, []);

	if (bootState.state === 'loading') {
		return (
			<LoadingOverlay
				loaderProps={{ size: 'md', color: 'white', variant: 'oval' }}
				visible
				overlayBlur={2}
				overlayColor="rgb(6,6,12)"
			/>
		);
	}

	if (bootState.state === 'errored') {
		return <ErrorRenderer error={bootState.error} />;
	}

	return (
		<StoryProvider
			namespace={props.namespace}
			height={props.height}
			viewFlags={props.viewFlags}
		/>
	);
});
