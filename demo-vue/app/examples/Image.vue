<template>
    <Page>
        <ActionBar>
            <NavigationButton text="Back" android.systemIcon="ic_menu_back" @tap="onBack"></NavigationButton>
        </ActionBar>
        <StackLayout>
            <CanvasView width="100%" height="100%" @draw="onDraw"/>
        </StackLayout>
    </Page>
</template>

<script lang="ts">
import * as frameModule from '@nativescript/core/ui/frame';
import Vue from 'nativescript-vue';
import { Component } from 'vue-property-decorator';
import { createRect, Paint, Style } from 'nativescript-canvas';
import { Color } from '@nativescript/core/color/color';
import { Folder, knownFolders, path } from '@nativescript/core/file-system/file-system';
import { fromFile, ImageSource } from '@nativescript/core/image-source/image-source';
import { screen } from '@nativescript/core/platform';

const iconLocalFile: ImageSource = fromFile(path.join( knownFolders.currentApp().path, 'images/test.jpg'));

@Component
export default class Image extends Vue {
    static title: 'Image Example';
    onBack() {
        frameModule.topmost().goBack();
    }
    onDraw(event: { canvas }) {
        const canvas = event.canvas;

        // const deviceScale = screen.mainScreen.scale;
        // canvas.scale(deviceScale, deviceScale); // always scale to device density to work with dp
        console.log('onDraw canvas:', canvas.getWidth(), canvas.getHeight());

        canvas.drawBitmap(iconLocalFile, null, createRect(0, 50, 200, 300), null);
    }
}
</script>
