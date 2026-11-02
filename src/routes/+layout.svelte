<script lang="ts">
	import '../app.css';

    let { children } = $props();
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';

</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
