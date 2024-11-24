import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-layout-page-main", {
    style: `
        :host {display:block;}

        @media only screen and (max-width: 768px) {
            :host {margin-top:3em;}
        }
    `,
    template: `
        <x-page-header class="hide-close">
            <x-breadcrumb slot="breadcrumb"></x-breadcrumb>
            <slot name="header"></slot>
        </x-page-header>
        <x-page-body class="">
            <slot></slot>
        </x-page-body>
    `
});
