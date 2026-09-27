<script setup lang="ts">
import { useRoute } from 'vue-router';

const route = useRoute();
const trekId = route.params.id as string;
</script>

<template>
    <h1>Détail du rando</h1>
    <p> Id de la rando {{ trekId }}</p>
</template>