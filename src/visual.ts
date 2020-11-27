/*
 *  Power BI Visual CLI
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual {
    'use strict';
    import legend = powerbi.extensibility.utils.chart.legend;
    import createLegend = powerbi.extensibility.utils.chart.legend.createLegend;
    import LegendData = powerbi.extensibility.utils.chart.legend.LegendData;
    import ILegend = powerbi.extensibility.utils.chart.legend.ILegend;
    import LegendPosition = powerbi.extensibility.utils.chart.legend.LegendPosition;
    import IValueFormatter = powerbi.extensibility.utils.formatting.IValueFormatter;
    import valueFormatter = powerbi.extensibility.utils.formatting.valueFormatter;
    import createInteractivitySelectionService = powerbi.extensibility.utils.interactivity.createInteractivitySelectionService;
    import SelectableDataPoint = powerbi.extensibility.utils.interactivity.SelectableDataPoint;
    import IInteractivityService = powerbi.extensibility.utils.interactivity.IInteractivityService;



    let colorsPersistObject: any = {};
    let legendData: LegendData;
    let colorLegend: IColorLegend[] = [];
    let eventURLFlag: boolean;
    let eventGroupFlag: boolean;
    let legendHeight: number;
    let calendarHeight: number;
    let calendarSelectionId: ISelectionId = [];
    let highlightedLegend: string = '';
    const textAdjustmentValue: number = 20;
    const heightAdjustmentvalue: number = 25;
    const minLengthWeekChangeSameYear: number = 15;
    const maxLengthWeekChangeSameYear: number = 20;
    const minLengthWeekChangeNextyear: number = 24;
    const maxLengthWeekChangeNextyear: number = 27;
    const daysInWeek: number = 7;
    const daysInDecember: number = 31;
    const comaLiteral: string = ',';
    const spaceLiteral: string = ' ';
    const dashLiteral: string = '-';
    const regex: RegExp = new RegExp(/[&\/\\#,+()$~%.'":*?<>{}]/g);
    const spaceRegex: RegExp = new RegExp(/\s/g);


    export interface CalendarFormatter {
        startDataFormatter: IValueFormatter;
        endDataFormatter: IValueFormatter;
    }

    module CalendarRoles {
        export const startDate: string = 'StartDate';
        export const endDate: string = 'EndDate';
        export const tooltip: string = 'Tooltip';
    }

    interface IColorLegend {
        keyName: string;
        color: string;
        selectionId: powerbi.visuals.ISelectionId;
    }

    interface IBusinessHours {
        startTime: string;
        endTime: string;
        workDay: number[];
    }

    /**
     * Provide dynamic colors to events and legends based on events or eventgroup
     *
     * @category {DataViewCategoryColumn}   : Category Column
     * @index {number}                      : index value
     * @objectName {string}                 : object name defined in capabilities.json.
     * @propertyName {string}               : property name as specified  for the object
     * @defaultValue {T}                    : default color that will be set
     * @return {property}                   : returns color to be applied
     */
    export function getCategoricalObjectValue<T>(category: DataViewCategoryColumn, index: number,
        objectName: string, propertyName: string, defaultValue: T): T {
        const categoryObjects: DataViewObject[] = category.objects;
        if (categoryObjects) {
            const categoryObject: DataViewObject = categoryObjects[index];
            if (categoryObject) {
                const object: DataViewPropertyValue = categoryObject[objectName];
                if (object) {
                    const property: T = object[propertyName];
                    if (property !== undefined) {
                        return property;
                    }
                }
            }
        }

        return defaultValue;
    }

    /**
     * Clear message, legend, selection when update method is called.
     */
    function clearAll(): void {
        d3.select('.fieldMessage').remove();
        d3.select('.calendar').remove();
        d3.selectAll('#legendGroup').selectAll('g').remove();
        d3.select('.legendTitle').remove();
    }

    /**
     * Check whether data is present in startDate databag and events Databag,
     *
     * @options {VisualUpdateOptions}       : Category Column
     * @return {boolean}                    : returns true if required data is present
     */
    function mandatoryDataPresent(options: VisualUpdateOptions): boolean {
        let isStartDate: boolean = false;
        let isEvent: boolean = false;

        const dataViewCategories: any[] = options.dataViews[0].categorical.categories;
        const categoriesLength: number = dataViewCategories.length;
        for (let iterator: number = 0; iterator < categoriesLength; iterator++) {
            if (dataViewCategories[iterator].source.roles.StartDate) {
                isStartDate = true;
            }
            if (dataViewCategories[iterator].source.roles.events) {
                isEvent = true;
            }
        }

        if (isStartDate === true && isEvent === true) {

            return true;
        }

        return false;
    }
    /**
     * Check whether mandatory data is present in required format
     *
     * @options {VisualUpdateOptions}       : Category Column
     * @return {boolean}                    : returns true if required data is present in required format
     */
    function mandatoryDataFormat(options: VisualUpdateOptions): boolean {

        const dataViewCategories: any[] = options.dataViews[0].categorical.categories;
        let isStartDateFormat: boolean = false;
        let isEventFormat: boolean = false;

        const categoriesLength: number = dataViewCategories.length;
        for (let iterator: number = 0; iterator < categoriesLength; iterator++) {
            if (dataViewCategories[iterator].source.roles.StartDate
                && dataViewCategories[iterator].source.type.dateTime) {
                isStartDateFormat = true;
            }
            if (dataViewCategories[iterator].source.roles.events
                && dataViewCategories[iterator].source.type.text) {
                isEventFormat = true;
            }
        }

        if (isStartDateFormat === true && isEventFormat === true) {

            return true;
        }

        return false;
    }
    /**
     * Declaration of the main class
     */
    export class Visual implements IVisual {
        private events: IVisualEventService;
        private settings: VisualSettings;
        private textNode: Text;
        private options: VisualConstructorOptions;
        private businessHoursObjectProperties: DataViewObject;
        private dataView: DataView;
        public host: IVisualHost;
        private element: HTMLElement;
        private isLandingPageOn: boolean;
        private landingPageRemoved: boolean;
        private landingPage: d3.Selection<any>;
        private static dataView: DataView;
        private legend: ILegend;
        private legendObjectProperties: DataViewObject;
        private selectionManager: ISelectionManager;
        private interactivityService: IInteractivityService<SelectableDataPoint>;

        //used for persisting Calendar View
        public calendarView: string = 'month';
        public persistedDate: string = '';
        private eventService: IVisualEventService;
        private locale: string;


        /**
         * Persist data stored in the variable calendarView.
         * @return {void}
         */
        public persistView(): void {
            const thisObj: Visual = this;
            let properties: { [propertyName: string]: DataViewPropertyValue };
            properties = {};
            properties[`calendarView`] = thisObj.calendarView;

            let persistCalendarView: VisualObjectInstancesToPersist;
            persistCalendarView = {
                replace: [
                    <VisualObjectInstance>{
                        objectName: 'persistCalendarView',
                        selector: null,
                        properties: properties
                    }]
            };
            thisObj.host.persistProperties(persistCalendarView);
        }

        /**
         * Retrive peristed string value
         * @return {string}                 : returns string value that has been persisted.
         */
        public retrieveView(): string {
            return this.settings.persistCalendarView.calendarView;
        }

        /**
         * Persist data stored in the variable persistedDate.
         * @return {void}
         */
        public persistDate(): void {
            const thisObj: Visual = this;
            let properties: { [propertyName: string]: DataViewPropertyValue };
            properties = {};
            properties[`persistedDate`] = thisObj.persistedDate;

            let persistCalendarDate: VisualObjectInstancesToPersist;
            persistCalendarDate = {
                replace: [
                    <VisualObjectInstance>{
                        objectName: 'persistCalendarDate',
                        selector: null,
                        properties: properties
                    }]
            };
            thisObj.host.persistProperties(persistCalendarDate);
        }

        /**
         * Retrive peristed string value
         * @return {string}                 : returns date value that has been persisted.
         */
        public retrieveDate(): string {
            const dateString: string = this.settings.persistCalendarDate.persistedDate;
            const todayliteral = getLocalizedString(this.locale, 'Today');
            if (dateString === 'today') {
                const today: Date = new Date();
                return monthName[(today.getMonth() + 1)] + spaceLiteral + today.getDate() + comaLiteral + spaceLiteral + today.getFullYear();
            }
            return dateString;
        }

        /**
         * Apply formatter to the data
         * @tooltipFormat {any}       : data format
         * @d{any}                    : data d
         * @return {string}           : formatted data after applying the formatter settings
         */

        public getFormattedValue(tooltipFormat: any, d: any): string {
            const primaryFormatter: IValueFormatter = valueFormatter.create({
                format: tooltipFormat
            });

            return primaryFormatter.format(d);
        }

        constructor(options: VisualConstructorOptions) {
            this.events = options.host.eventService;
            this.options = options;
            this.host = options.host;
            this.legend = createLegend(options.element, false, null, true);
            this.eventService = options.host.eventService;
            this.interactivityService = createInteractivitySelectionService(this.host);
            this.legend = createLegend(options.element, false, this.interactivityService, true);
            this.element = options.element;
            this.selectionManager = options.host.createSelectionManager();
            this.locale = options.host.locale;

            const dashboard: d3.Selection<any> = d3.select(options.element).append('div').attr('id', 'dashboard');
        }

        /**
         * update() is called called whenever there is a change in the data or host environment.
         * @options {VisualUpdateOptions}
         * @return {void}
         */
        private clearmessage(colorsPersistedArray: string, options: VisualUpdateOptions, viewPortHeight: number, dataViewCategories: any[]) {
            const colorsParsedArray: any = JSON.parse(colorsPersistedArray);
            if (colorsPersistedArray !== '{}') {
                colorsPersistObject = colorsParsedArray;
            }
            //Clear message, selections, legend from screen
            clearAll();
            d3.select('#dashboard')
                .append('div')
                .classed('calendar', true)
                .append('div')
                .classed('fieldMessage', true)
                .attr('id', 'calendar');
            //If mandatory field values are not entered, show error message
            const isMandatoryDataPresent: boolean = mandatoryDataPresent(options);
            if (!isMandatoryDataPresent) {
                d3.select('.fieldMessage').text(`'Start Date' and 'Event' are required fields`);
                d3.select('.fieldMessage').style('padding-top', `${(viewPortHeight / 2) - textAdjustmentValue}px`);
            }
            //If mandatory field values are entered, and data is not in correct format
            const isMandatoryDataFormat: boolean = mandatoryDataFormat(options);
            if (!isMandatoryDataFormat && isMandatoryDataPresent) {
                d3.select('.fieldMessage').text(`'Start date' should be in 'datetime' format & 'Events' should be in 'text' format.`);
                d3.select('.fieldMessage').style('padding-top', `${(viewPortHeight / 2) - textAdjustmentValue}px`);
                // Initialized the 'dataViewCategories' to null so that calendar is not rendered
                dataViewCategories[0] = null;
            }
        }
        private legendrender(eventGroupIndex: number, eventGroupColumn: DataViewCategoryColumn, dataViewCategories: any[], startDateLength: number, eventColumn
            : DataViewCategoryColumn, startDateCategory: DataViewCategoryColumn,
            eventArray: string[], eventIndex: number, eventGroupArray: string[]) {// If user enters data in Event Group databag, legends will be rendered on event group
            if (eventGroupIndex !== null) {
                eventGroupColumn = dataViewCategories[eventGroupIndex];
                colorLegend = [];
                const uniqueValues: string[] = [];
                for (let index: number = 0; index < startDateLength; index++) {
                    if (uniqueValues.indexOf(<string>dataViewCategories[eventGroupIndex].values[index]) === -1 &&
                        uniqueValues.indexOf('Others') === -1) {
                        let tempEventGroup: string;
                        tempEventGroup = eventGroupColumn.values[index] !== null ? eventGroupColumn.values[index].toString() : 'Others';
                        const label: string = tempEventGroup;
                        const catPresent: boolean = label in colorsPersistObject;
                        const defaultColor: string = catPresent ? colorsPersistObject[label] : this.host.colorPalette.getColor(tempEventGroup).value;
                        colorsPersistObject[label] = getCategoricalObjectValue<Fill>(eventColumn, index, 'colorSelector', 'fillColor', {
                            solid: {
                                color: defaultColor
                            }
                        }).solid.color;
                        colorLegend.push({
                            keyName: tempEventGroup,
                            color: colorsPersistObject[label],
                            selectionId: this.host.createSelectionIdBuilder().withCategory(startDateCategory, index).createSelectionId()
                        });
                        uniqueValues.push(dataViewCategories[eventGroupIndex].values[index] !== null ?
                            <string>dataViewCategories[eventGroupIndex].values[index] : <string>dataViewCategories[eventGroupIndex].values[index]);
                    }
                    eventArray.push(<string>dataViewCategories[eventIndex].values[index]);
                    eventGroupArray.push(dataViewCategories[eventGroupIndex].values[index] !== null
                        ? eventGroupColumn.values[index].toString() : 'Others');
                }
            } else {  // If user  does not enters data in Event Group, legends will be rendered based on events
                colorLegend = [];
                const uniqueValues: string[] = [];
                for (let index: number = 0; index < startDateLength; index++) {
                    if (uniqueValues.indexOf(<string>dataViewCategories[eventIndex].values[index]) === -1) {
                        const label: string = eventColumn.values[index].toString();
                        const catPresent: boolean = label in colorsPersistObject;
                        const defaultColor: string = catPresent ? colorsPersistObject[label] :
                            this.host.colorPalette.getColor(eventColumn.values[index].toString()).value;
                        colorsPersistObject[label] = getCategoricalObjectValue<Fill>(eventColumn, index, 'colorSelector', 'fillColor', {
                            solid: {
                                color: defaultColor
                            }
                        }).solid.color;
                        colorLegend.push({
                            keyName: eventColumn.values[index].toString(),
                            color: colorsPersistObject[label],
                            selectionId: this.host.createSelectionIdBuilder().withCategory(eventColumn, index).createSelectionId()
                        });
                        uniqueValues.push(<string>dataViewCategories[eventIndex].values[index]);
                    }
                    eventArray.push(<string>dataViewCategories[eventIndex].values[index]);
                }
            }
        }
        private tooltip(descriptionFlag: number, startDateArray: any, tooltipString: string, tooltipDataIndex: number[], dataViewCategories: any[],
            toolTipDataColumnName: string[], tooltipData: string[], eventArray: string[], uniqueEvents: string[], eventGroupIndex: number, eventGroupArray: string[]
            , eventGroupName: string, eventColors: string[], eventName: string, options: VisualUpdateOptions) {
            if (descriptionFlag === 1) {
                for (let index: number = 0; index < startDateArray.length; index++) {
                    tooltipString = '';
                    for (let iterator: number = 0; iterator < tooltipDataIndex.length; iterator++) {
                        if (iterator === 0) {
                            tooltipString = tooltipString.concat('\n');
                        }
                        const dv: any = dataViewCategories[tooltipDataIndex[iterator]];
                        tooltipString = tooltipString.concat(toolTipDataColumnName[iterator]);
                        tooltipString = tooltipString.concat(' : ');
                        if (dv.source.type.dateTime) {
                            if (<string>dv.values[index] !== null) {
                                tooltipString = tooltipString.concat(
                                    this.getFormattedValue(dv.source.format,
                                        new Date(dv.values[index])));
                            } else {
                                tooltipString = tooltipString.concat('Data Unavailable');
                            }
                        } else {
                            if (<string>dv.values[index] !== null) {
                                tooltipString = tooltipString.concat(
                                    this.getFormattedValue(dv.source.format,
                                        (dv.values[index])));
                            } else {
                                tooltipString = tooltipString.concat('Data Unavailable');
                            }
                        }
                        tooltipString = tooltipString.concat('\n');
                    }
                    tooltipData.push(tooltipString);
                }
            }
            for (let index: number = 0; index < eventArray.length; index++) {
                if (jQuery.inArray(eventArray[index], uniqueEvents) === -1) {
                    uniqueEvents.push(eventArray[index]);
                }
            }
            if (eventGroupIndex !== null) {
                for (let index: number = 0; index < eventGroupArray.length; index++) {
                    eventGroupName = eventGroupArray[index];
                    for (let iterator: number = 0; iterator < colorLegend.length; iterator++) {
                        if (eventGroupName === colorLegend[iterator].keyName) {
                            eventColors[index] = colorLegend[iterator].color;
                            break;
                        }
                    }
                }
            } else {
                for (let index: number = 0; index < eventArray.length; index++) {
                    eventName = eventArray[index];
                    for (let iterator: number = 0; iterator < colorLegend.length; iterator++) {
                        if (eventName === colorLegend[iterator].keyName) {
                            eventColors[index] = colorLegend[iterator].color;
                            break;
                        }
                    }
                    eventGroupArray.push('blank');
                }
            } if (this.settings.legend.show) {
                this.createLegend(options);
                legendHeight = this.legend.getMargins().height;
            } else if (this.settings.legend.show === false) {
                d3.select('#legendGroup').selectAll('g').remove();
                d3.select('.legendTitle').remove();
                d3.select('#dashboard').style('margin-top', '0');
                legendHeight = null;
            }
            if (legendHeight === null) {
                calendarHeight = options.viewport.height;
            } else {
                calendarHeight = options.viewport.height - legendHeight - heightAdjustmentvalue;
            }
        }
        public update(options: VisualUpdateOptions): void {
            try {
                this.events.renderingStarted(options);
                this.settings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]);
                const thisObj: this = this; const startDateArray: any = []; this.handleLandingPage(options);
                const eventArray: string[] = []; const endDateArray: any = []; const eventGroupArray: string[] = []; const uniqueEvents: string[] = [];
                const uniqueColors: string[] = []; const eventColors: string[] = []; const eventURLArray: string[] = [];
                const eventGroup: string[] = []; const colors: string[] = []; const descriptionArray: string[] = []; let descriptionFlag: number = 0;
                const businessHours: IBusinessHours[] = []; const workDay: number[] = []; calendarSelectionId = [];
                // contains index of category data, dragged into tooltip data bag
                const tooltipDataIndex: number[] = []; const toolTipDataColumnName: string[] = [];
                let eventName: string; let eventGroupName: string;
                let startDateIndex: number; let endDateIndex: number = null; let eventIndex: number; let eventGroupIndex: number = null; let eventURLIndex: number = null;
                eventGroupFlag = false; eventURLFlag = false; let descriptionIndex: number = null; let categoriesLength: number; let endDateLength: number;
                let startDateCategory: DataViewCategoryColumn; let startWeekDay: number; let category: DataViewCategoryColumn;
                const dataViews: DataView = options.dataViews[0]; const dataViewCategories: any[] = dataViews.categorical.categories;
                const viewPortHeight: number = options.viewport.height; const viewPortWidth: number = options.viewport.width;
                colorsPersistObject = {}; const colorsPersistedArray: string = this.settings.caption.captionValue;
                let eventURLLength: number;
                category = dataViews.categorical.categories[0];
                //Retrieve persisted colors array value
                this.clearmessage(colorsPersistedArray, options, viewPortHeight, dataViewCategories);
                categoriesLength = dataViewCategories.length;
                for (let index: number = 0; index < categoriesLength; index++) {
                    if (dataViewCategories[index].source.roles.StartDate) { startDateIndex = index; startDateCategory = dataViewCategories[index]; }
                    if (dataViewCategories[index].source.roles.EndDate) { endDateIndex = index; endDateLength = dataViewCategories[endDateIndex].values.length; }
                    if (dataViewCategories[index].source.roles.events) { eventIndex = index; }
                    if (dataViewCategories[index].source.roles.EventGroup) { eventGroupIndex = index; eventGroupFlag = true; }
                    if (dataViewCategories[index].source.roles.EventURL) { eventURLIndex = index; eventURLFlag = true; }
                    if (dataViewCategories[index].source.roles.description) {
                        descriptionFlag = 1; descriptionIndex = index;
                        // to avoid repitition of values in tool tip
                        if (toolTipDataColumnName.length !== 0) {
                            for (let iterator: number = 0; iterator <= (toolTipDataColumnName.length - 1); iterator++) {
                                if (toolTipDataColumnName.indexOf(dataViewCategories[index].source.displayName) === -1) { tooltipDataIndex.push(index); toolTipDataColumnName.push(dataViewCategories[index].source.displayName); }
                            }
                        } else { tooltipDataIndex.push(index); toolTipDataColumnName.push(dataViewCategories[index].source.displayName); }
                    }
                }
                for (let index: number = 0; index < dataViewCategories[0].values.length; index++) {
                    const selectionId: ISelectionId = this.host.createSelectionIdBuilder().withCategory(category, index).createSelectionId();
                    calendarSelectionId[index] = selectionId;
                }

                if (eventURLFlag) {
                    eventURLLength = dataViewCategories[eventURLIndex].values.length;
                    for (let index: number = 0; index < eventURLLength; index++) {
                        eventURLArray.push(<string>dataViewCategories[eventURLIndex].values[index]);
                    }
                }
                const startDateLength: number = dataViewCategories[startDateIndex].values.length; const eventLength: number = dataViewCategories[eventIndex].values.length;
                for (let index: number = 0; index < startDateLength; index++) {
                    startDateArray.push(dataViewCategories[startDateIndex].values[index]
                        ? new Date(dataViewCategories[startDateIndex].values[index]) : null);
                    if (endDateIndex !== null) { endDateArray.push(dataViewCategories[endDateIndex].values[index] !== null ? (new Date(dataViewCategories[endDateIndex].values[index])) : null); }
                }
                const categoryColumn: DataViewCategoryColumn = dataViewCategories[startDateIndex]; const eventColumn: DataViewCategoryColumn = dataViewCategories[eventIndex];
                let eventGroupColumn: DataViewCategoryColumn;
                this.legendrender(eventGroupIndex, eventGroupColumn, dataViewCategories, startDateLength, eventColumn, startDateCategory,
                    eventArray, eventIndex, eventGroupArray);
                // Add tool tip using titile, append data to tooltip string.
                let tooltipString: string = ''; const tooltipData: string[] = [];
                this.tooltip(descriptionFlag, startDateArray, tooltipString, tooltipDataIndex, dataViewCategories, toolTipDataColumnName, tooltipData, eventArray, uniqueEvents, eventGroupIndex, eventGroupArray, eventGroupName, eventColors, eventName, options);
                // Get List of all the days that needs to be displayed as working day
                if (this.settings.workDays.weekendSunday) { workDay.push(0); }
                if (this.settings.workDays.weekdayMonday) { workDay.push(1); }
                if (this.settings.workDays.weekdayTuesday) { workDay.push(2); }
                if (this.settings.workDays.weekdayWednesday) { workDay.push(3); }
                if (this.settings.workDays.weekdayThursday) { workDay.push(4); }
                if (this.settings.workDays.weekdayFriday) { workDay.push(5); }
                if (this.settings.workDays.weekendSaturday) { workDay.push(6); }
                const startTime: string = this.settings.workHours.startTime;
                let endTime: string = this.settings.workHours.endTime;
                if (endTime < startTime && startTime !== '00:00') { endTime = startTime; this.settings.workHours.endTime = startTime; }
                businessHours.push({ startTime: startTime, endTime: endTime, workDay: workDay });
                // Get week day name to set beginning week in the calendar
                switch (this.settings.calendarSettings.startingWeekDay) {
                    case 'Monday': { startWeekDay = 1; this.settings.calendarSettings.startingWeekDay = 'Monday'; break; }
                    case 'Tuesday': { startWeekDay = 2; this.settings.calendarSettings.startingWeekDay = 'Tuesday'; break; }
                    case 'Wednesday': { startWeekDay = 3; this.settings.calendarSettings.startingWeekDay = 'Wednesday'; break; }
                    case 'Thursday': { startWeekDay = 4; this.settings.calendarSettings.startingWeekDay = 'Thursday'; break; }
                    case 'Friday': { startWeekDay = 5; this.settings.calendarSettings.startingWeekDay = 'Friday'; break; }
                    case 'Saturday': { startWeekDay = 6; this.settings.calendarSettings.startingWeekDay = 'Saturday'; break; }
                    case 'Sunday': { startWeekDay = 0; this.settings.calendarSettings.startingWeekDay = 'Sunday'; break; }
                    default: { startWeekDay = 1; this.settings.calendarSettings.startingWeekDay = 'Monday'; break; }
                }
                // If a view that is persisted is turned off, show default view.
                const persistedView: string = this.retrieveView();
                if ((persistedView === '' || persistedView === null) || (persistedView === 'agendaWeek' && !this.settings.buttons.week) || (persistedView === 'agendaDay' && !this.settings.buttons.day) || (persistedView === 'listMonth' && !this.settings.buttons.list)) {
                    this.calendarView = 'month'; this.persistView();
                }
                let visualWidth = options.viewport.width;
                if (descriptionFlag === 1) {
                    this.getDatawithDescription(options, startDateArray, endDateArray, eventArray, eventColors, businessHours, tooltipData, eventGroupArray, eventURLArray, startWeekDay, visualWidth);
                } else {
                    this.getData(options, startDateArray, endDateArray, eventArray, eventColors, businessHours, eventGroupArray, eventURLArray, startWeekDay, visualWidth);
                }
                //Persist colors array
                this.settings.caption.captionValue = '{}'; let properties: { [propertyName: string]: DataViewPropertyValue }; properties = {};
                properties[`captionValue`] = JSON.stringify(colorsPersistObject);
                let caption1: VisualObjectInstancesToPersist;
                caption1 = {
                    replace: [{ objectName: 'caption', selector: null, properties: properties }]
                };
                this.host.persistProperties(caption1);
                d3.selectAll(".event").on("contextmenu", () => {
                    const mouseEvent: MouseEvent = <MouseEvent>d3.event;
                    const eventTarget: EventTarget = mouseEvent.target;
                    var test1: any = mouseEvent.currentTarget;
                    var test = test1.__data__;
                    if (test !== undefined) {
                        this.selectionManager.showContextMenu(test, { x: mouseEvent.clientX, y: mouseEvent.clientY });
                        mouseEvent.preventDefault();
                    }
                });
                this.eventService.renderingFinished(options);
            } catch (exception) { this.eventService.renderingFailed(options, exception); }
        }

        private static parseSettings(dataView: DataView): VisualSettings {
            return <VisualSettings>VisualSettings.parse(dataView);
        }

        /**
         * Add interactivity to legends and events
         *
         * @dataArray {string[]}                                   : contains list of event data
         * @selectionIdArray {ISelectionId[]}                      : contains array of selection Ids
         * @return {void}
         */
        public addSelection(dataArray: string[], selectionIdArray: ISelectionId[]): void {
            let selectedSelectionId: ISelectionId[] = [];
            let currentThis: this;
            currentThis = this;

            let legends: any;
            legends = d3.selectAll('.legendItem');
            const selectionManager: ISelectionManager = this.selectionManager;

            legends.on('click', (d: any) => {
                let legends: any;
                legends = d3.selectAll('.legendItem');
                if (d.tooltip !== highlightedLegend || (highlightedLegend === null) || highlightedLegend === '') {
                    const selectedLegend: string = d.tooltip;
                    highlightedLegend = d.tooltip;
                    const dataArrayLength: number = dataArray.length;
                    for (let iterator: number = 0; iterator < dataArrayLength; iterator++) {
                        if (selectedLegend === dataArray[iterator]) {
                            selectedSelectionId.push(selectionIdArray[iterator]);
                        }
                    }

                    selectionManager.select(selectedSelectionId).then((ids: any[]) => {
                        const className: string = currentThis.encodeData(d.tooltip);
                        d3.selectAll('.event').style('opacity', ids.length > 0 ? 0.5 : 1);
                        d3.selectAll(`.${className}`).style('opacity', 1);

                        let selectedEvent: any;
                        selectedEvent = d3.selectAll('.fc-day-grid-event fc-h-event fc-event fc-start fc-end fc-draggable');
                        legends.attr({
                            'fill-opacity': ids.length > 0 ? 0.5 : 1
                        });

                        d3.selectAll('.legendItem').attr({
                            'fill-opacity': 1
                        });
                        selectedSelectionId = [];
                    });
                    (<Event>d3.event).stopPropagation();
                } else if (d.tooltip !== highlightedLegend) {
                    d3.selectAll('.event').style('opacity', 1);
                    d3.selectAll(legends).attr('fill-opacity', 1);
                    highlightedLegend = '';
                }
            });
            d3.select('html').on('click', () => {
                selectionManager.clear();
                d3.selectAll('.event').style('opacity', 1);
                d3.selectAll('.legendItem').attr('fill-opacity', 1);
                highlightedLegend = '';
            });
        }


        /**
         * Method to create legends
         *
         * @options {options}         : options
         * @return {void}
         */

        public createLegend(options: any): void {

            const dataViewCategories: any[] = options.dataViews[0].categorical.categories;
            const categoriesLength: number = dataViewCategories.length;
            let startDateIndex: number;
            let eventIndex: number = null;
            let eventGroupIndex: number = null;
            let legendIndex: number;
            for (let index: number = 0; index < categoriesLength; index++) {
                if (dataViewCategories[index].source.roles.StartDate) {
                    startDateIndex = index;
                }
                if (dataViewCategories[index].source.roles.events) {
                    eventIndex = index;
                }
                if (dataViewCategories[index].source.roles.EventGroup) {
                    eventGroupIndex = index;
                }
            }
            if (eventGroupIndex !== null) {
                legendIndex = eventGroupIndex;
            } else {
                legendIndex = eventIndex;
            }


            const selectionID: any[] = [];
            const startDateDataLength: number = dataViewCategories[startDateIndex].values.length;
            const data: string[] = [];

            if (eventGroupIndex !== null) {
                for (let index: number = 0; index < startDateDataLength; index++) {
                    data.push(dataViewCategories[eventGroupIndex].values[index]);
                    selectionID.push(this.host.createSelectionIdBuilder().withCategory(
                        dataViewCategories[0], index).createSelectionId());
                }
            } else {
                for (let index: number = 0; index < startDateDataLength; index++) {
                    data.push(dataViewCategories[eventIndex].values[index]);
                    selectionID.push(this.host.createSelectionIdBuilder().withCategory(
                        dataViewCategories[0], index).createSelectionId());
                }
            }

            const legendTitle: string = dataViewCategories[legendIndex].source.displayName;
            this.settings.legend.fontSize = this.settings.legend.fontSize > 18 ? 18 : this.settings.legend.fontSize;
            legendData = {
                dataPoints: [],
                title: legendTitle,
                fontSize: this.settings.legend.fontSize,
                labelColor: this.settings.legend.labelColor
            };

            const colorLegendLength: number = colorLegend.length;
            for (let legendIterator: number = 0; legendIterator < colorLegendLength; legendIterator++) {
                legendData.dataPoints.push({
                    label: colorLegend[legendIterator].keyName,
                    color: colorLegend[legendIterator].color,
                    icon: powerbi.extensibility.utils.chart.legend.LegendIcon.Box,
                    selected: false,
                    identity: this.host.createSelectionIdBuilder().withCategory(
                        dataViewCategories[0], legendIterator).createSelectionId()
                });
                if ((this.settings.legend.position) === 'Top') {
                    d3.select('#dashboard').style('margin-top', '50px');
                    this.legend.changeOrientation(LegendPosition.Top);
                } else {
                    d3.select('#dashboard').style('margin-top', '0');
                    this.legend.changeOrientation(LegendPosition.Bottom);
                }

                this.legend.drawLegend(legendData, options.viewport);
            }
            const THIS: this = this;
            this.addSelection(data, selectionID);

            $('.legend #legendGroup').on('click.load', '.navArrow', () => {
                THIS.addSelection(data, selectionID);
            });
        }

        /**
         * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the
         * objects and properties you want to expose to the users in the property pane.
         *
         */

        /**
         * Method to render calendar when data is dragged in tool tip databag
         * @options{any}                  : options
         * @startDateArray{any[]}         : array that contains start date of all the events
         * @endDateArray{any[]}           : array that contains end date for all the events
         * @eventArray{string[]}          : array of events
         * @eventColors{string[]}         : array of colors for events
         * @workHours{any[]}              : contains startTime, endTime, work Days
         * @descriptionArray{string[]}    : contains tooltip data
         * @eventGroupArray{string[]}     : contains arry of eventGroup for eventss
         * @startWeekDay{number}          : contains week start day number
         *
         * @return{void}
         */
        public getDatawithDescription(options: any, startDateArray: any[], endDateArray: any[], eventArray: string[], eventColors: string[], workHours: any[], descriptionArray: string[], eventGroupArray: string[], eventURLArray: string[], startWeekDay: number, visualWidth: number): void {
            let fullCalendarlib: any = $.fullCalendar;
            let localesList = fullCalendarlib.locales;
            let currentLocale: string = this.mapCurrentLocale(this.locale.toLowerCase(), localesList);
            const thisObj: this = this;
            const today: Date = new Date();
            const todayliteral: any = localesList[currentLocale]["buttonText"] ? localesList[currentLocale]["buttonText"]["today"] : 'Today';
            const monthliteral: any = localesList[currentLocale]["buttonText"] ? localesList[currentLocale]["buttonText"]["month"] : 'Month';
            const weekliteral: any = localesList[currentLocale]["buttonText"] ? localesList[currentLocale]["buttonText"]["week"] : 'Week';
            const listliteral: any = localesList[currentLocale]["buttonText"] ? localesList[currentLocale]["buttonText"]["list"] : "List";
            const dayliteral: any = localesList[currentLocale]["buttonText"] ? localesList[currentLocale]["buttonText"]["day"] : 'Day';
            const eventLimitText: any = localesList[currentLocale]["eventLimitText"] ? localesList[currentLocale]["eventLimitText"] : "more";
            const weekNumberTitle: any = localesList[currentLocale]["weekNumberTitle"] ? localesList[currentLocale]["weekNumberTitle"] : "W";
            const allDayHtml: any = localesList[currentLocale]["allDayHtml"] ? localesList[currentLocale]["allDayHtml"] : '';
            const dayOfMonthFormat: any = localesList[currentLocale]["dayOfMonthFormat"];
            const noEventsMessage: any = localesList[currentLocale]["noEventsMessage"] ? localesList[currentLocale]["noEventsMessage"] : "No events to display";
            const todayString: string = monthName[(today.getMonth() + 1)] + spaceLiteral + today.getDate() + comaLiteral + spaceLiteral + today.getFullYear();
            const persistedDate: string = this.retrieveDate();
            let showCalendarDate: string;
            if (persistedDate === null || persistedDate === '' || persistedDate === 'today') {
                showCalendarDate = todayString;
                thisObj.persistedDate = showCalendarDate;
                thisObj.persistDate();
            } else { showCalendarDate = persistedDate; }
            let index: number = 0; const jsonObj: any = [];
            const eventArrayLength: number = eventArray.length;
            for (index = 0; index < eventArrayLength; index++) {
                jsonObj.push({
                    id: index,
                    title: eventArray[index],
                    start: startDateArray[index],
                    end: endDateArray[index],
                    backgroundColor: eventColors[index],
                    description: descriptionArray[index],
                    group: eventGroupArray[index],
                    url: eventURLArray[index],
                    selectionId: calendarSelectionId[index]
                });
            }
            const buttons: string[] = [];
            if (this.settings.buttons.month) { buttons.push('month'); }
            if (this.settings.buttons.week) { buttons.push('agendaWeek'); }
            if (this.settings.buttons.day) { buttons.push('agendaDay'); }
            if (this.settings.buttons.list) { buttons.push('listMonth'); }
            console.log(workHours[0].endTime);
            $('.calendar').fullCalendar({
                locale: this.locale,
                navLinks: this.settings.calendarSettings.navLink, eventLimit: true,
                views: {
                    month: {
                        eventLimit: 3, displayEventTime: false
                    },
                    agendaWeek: {
                        eventLimit: 3, displayEventTime: false
                    },
                    list: { displayEventTime: true }, agendaDay: {}
                },
                header: { left: 'prev,next today', center: 'title', right: buttons.join(',') },
                firstDay: startWeekDay, height: calendarHeight, handleWindowResize: true,
                defaultDate: new Date(showCalendarDate), defaultView: this.retrieveView(), allDaySlot: false,
                isRTL: this.settings.calendarSettings.rtl,
                allDayText: allDayHtml,
                weekNumbers: this.settings.calendarSettings.weekNumber,
                eventLimitText: eventLimitText,
                weekNumberTitle: this.settings.calendarSettings.weekNumber ? weekNumberTitle : '',
                businessHours: [{ dow: workHours[0].workDay, start: workHours[0].startTime, end: workHours[0].endTime }],
                buttonText: {
                    today: todayliteral, month: monthliteral, week: weekliteral, day: dayliteral, list: listliteral
                },
                nowIndicator: this.settings.calendarSettings.currentTimeLine,
                editable: false, selectable: true, events: jsonObj,
                eventTextColor: this.settings.events.fontColor,
                eventBorderColor: this.settings.events.borderColor,
                eventRender: (event: any, element: any) => {
                    element.attr("id", event.id);
                    let className: string;
                    if (eventGroupFlag) { className = thisObj.encodeData(event.group); }
                    else { className = thisObj.encodeData(event.title); }
                    element.attr('title', `${event.title} : ${event.description}`);
                    element.addClass(className); element.addClass('event');
                    if (!eventURLFlag || !(this.settings.url.show)) {
                        element.on('click', (d: any) => {
                            let id = Number(d.currentTarget.id);;
                            thisObj.selectionManager.select(calendarSelectionId[id]).then((ids: ISelectionId[]) => {
                                const className: string = thisObj.encodeData(d.currentTarget.innerText);
                                d3.selectAll('.event').style('opacity', ids.length > 0 ? 0.5 : 1);
                                d3.select(d.currentTarget).style('opacity', 1);
                                d.stopPropagation();
                            });
                        });
                    }
                },
                eventClick: function (calEvent, jsEvent, view) {
                    if (thisObj.settings.url.show) {
                        thisObj.host.launchUrl(calEvent.url);
                    }
                    else {
                        const mouseEvent: MouseEvent = <MouseEvent>d3.event;
                        const eventTarget: EventTarget = mouseEvent.target;
                        const dataPoint: any = d3.select(eventTarget).datum();
                        if (dataPoint !== undefined) {
                            this.selectionManager.showContextMenu(dataPoint.identity, { x: mouseEvent.clientX, y: mouseEvent.clientY });
                            mouseEvent.preventDefault();
                        }
                    }

                }
            });
            let events = d3.selectAll('.event')[0];
            events.forEach((e, i): any => {
                var test = $(e).attr('id');
                var selectionID = calendarSelectionId[test];
                e["__data__"] = selectionID;
            });
            if (visualWidth > 1200) {
                this.handleFontSettings();

            }
            else if (visualWidth > 500) {
                this.handleFontSettingsMin();

            }
            else {
                this.handleFontSettingsMin1();

            }
            this.customFormat();
            if (this.locale === 'ar-SA') { d3.select('#dashboard').selectAll('.fc-content').style('text-align', 'right'); }
            d3.select('.fc-month-button').on('click', () => {
                thisObj.calendarView = 'month'; thisObj.persistView();
            });
            d3.select('.fc-agendaWeek-button').on('click', () => {
                thisObj.calendarView = 'agendaWeek'; thisObj.persistView();
            });
            d3.select('.fc-agendaDay-button').on('click', () => {
                thisObj.calendarView = 'agendaDay'; thisObj.persistView();
            });
            d3.select('.fc-listMonth-button').on('click', () => {
                thisObj.calendarView = 'listMonth'; thisObj.persistView();
            });
            d3.select('.fc-prev-button').on('click', () => {
                let date: any = $('.calendar').fullCalendar('getDate');
                let nowDate = new Date(date).toString();
                thisObj.persistedDate = nowDate; thisObj.persistDate();

            });
            d3.select('.fc-next-button').on('click', () => {
                let date: any = $('.calendar').fullCalendar('getDate');
                let nowDate = new Date(date).toString();
                thisObj.persistedDate = nowDate; thisObj.persistDate();

            });
            d3.select('.fc-today-button').on('click', () => { thisObj.persistedDate = 'today'; thisObj.persistDate(); });
        }
        public persist(view: string): any {
            this.calendarView = view;
            this.persistView();
        }

        /**
         * Method to format string and remove pecial characters and spaes
         * @data{string}         : data to be formatted
         * @data{string}         : formatted data
         */
        public removeSpecialCharacter(data: string): string {
            data = data.replace(regex, '');
            data = data.trim();

            return data;
        }
        /**
         * Method to encode the variables
         */
        public encodeData(value: string): string {
            if (value === '') {
                return value.replace('', 'sp');
            }
            if (value === null) {
                return value.replace('', 'blank');
            }

            return value.replace(/[^A-Z0-9]/ig, 'sp');
        }

        /**
         * Method to render calendar when tool tip data bag is empty
         * @options{any}                  : options
         * @startDateArray{any[]}         : array that contains start date of all the events
         * @endDateArray{any[]}           : array that contains end date for all the events
         * @eventArray{string[]}          : array of events
         * @eventColors{string[]}         : array of colors for events
         * @workHours{any[]}              : contains startTime, endTime, work Days
         * @eventGroupArray{string[]}     : contains arry of eventGroup for eventss
         * @startWeekDay{number}          : contains week start day number
         *
         * @return{void}
         */
        public getData(options: any, startDateArray: any[], endDateArray: any[], eventArray: string[], eventColors: string[], workHours: any[], eventGroupArray: string[], eventURLArray: string[], startWeekDay: number, visualWidth: number): void {
            let fullCalendarlib: any = $.fullCalendar;
            let localesList = fullCalendarlib.locales;
            let currentLocale: string = this.mapCurrentLocale(this.locale.toLowerCase(), localesList);
            const thisObj: this = this; let showCalendarDate: string;
            const today: Date = new Date();
            const todayliteral: any = localesList[currentLocale]["buttonText"] ? localesList[currentLocale]["buttonText"]["today"] : 'Today';
            const monthliteral: any = localesList[currentLocale]["buttonText"] ? localesList[currentLocale]["buttonText"]["month"] : 'Month';
            const weekliteral: any = localesList[currentLocale]["buttonText"] ? localesList[currentLocale]["buttonText"]["week"] : 'Week';
            const listliteral: any = localesList[currentLocale]["buttonText"] ? localesList[currentLocale]["buttonText"]["list"] : "List";
            const dayliteral: any = localesList[currentLocale]["buttonText"] ? localesList[currentLocale]["buttonText"]["day"] : 'Day';
            const eventLimitText: any = localesList[currentLocale]["eventLimitText"] ? localesList[currentLocale]["eventLimitText"] : "more";
            const weekNumberTitle: any = localesList[currentLocale]["weekNumberTitle"] ? localesList[currentLocale]["weekNumberTitle"] : "W";
            const allDayHtml: any = localesList[currentLocale]["allDayHtml"] ? localesList[currentLocale]["allDayHtml"] : '';
            const dayOfMonthFormat: any = localesList[currentLocale]["dayOfMonthFormat"];
            const noEventsMessage: any = localesList[currentLocale]["noEventsMessage"] ? localesList[currentLocale]["noEventsMessage"] : "No events to display";

            const todayString: string = monthName[(today.getMonth() + 1)] + spaceLiteral + today.getDate() + comaLiteral + spaceLiteral + today.getFullYear();
            const persistedDate: string = this.retrieveDate();
            if (persistedDate === null || persistedDate === '') {
                showCalendarDate = todayString;
                thisObj.persistedDate = showCalendarDate;
                thisObj.persistDate();
            } else { showCalendarDate = persistedDate; thisObj.persistedDate = showCalendarDate; }
            let index: number = 0; const jsonObj: any = [];
            // Creates JSON object for events
            const eventArrayLength: number = eventArray.length;
            for (index = 0; index < eventArrayLength; index++) {
                jsonObj.push({
                    id: index,
                    title: eventArray[index],
                    start: startDateArray[index],
                    end: endDateArray[index],
                    backgroundColor: eventColors[index],
                    group: eventGroupArray[index],
                    url: eventURLArray[index],
                    selectionId: calendarSelectionId[index]
                });
            }
            const buttons: string[] = [];
            if (this.settings.buttons.month) { buttons.push('month'); }
            if (this.settings.buttons.week) { buttons.push('agendaWeek'); }
            if (this.settings.buttons.day) { buttons.push('agendaDay'); }
            if (this.settings.buttons.list) { buttons.push('listMonth'); }
            console.log(workHours[0].endTime);
            $('.calendar').fullCalendar({
                locale: this.locale,
                navLinks: this.settings.calendarSettings.navLink,
                eventLimit: true,
                views: {
                    month: { eventLimit: 3, displayEventTime: false },
                    week: { eventLimit: 3, displayEventTime: false },
                    list: { displayEventTime: true }
                },
                header: { left: 'prev,next today', center: 'title', right: buttons.join(',') },
                firstDay: startWeekDay,
                height: calendarHeight,
                handleWindowResize: true,
                defaultDate: new Date(showCalendarDate),
                defaultView: this.retrieveView(), allDaySlot: false,
                isRTL: this.settings.calendarSettings.rtl,
                allDayText: allDayHtml,
                weekNumbers: this.settings.calendarSettings.weekNumber,
                eventLimitText: eventLimitText,
                weekNumberTitle: this.settings.calendarSettings.weekNumber ? weekNumberTitle : '',
                businessHours: [
                    {
                        dow: workHours[0].workDay, start: workHours[0].startTime, end: workHours[0].endTime
                    }
                ],
                buttonText: {
                    today: todayliteral, month: monthliteral, week: weekliteral, day: dayliteral, list: listliteral
                },
                nowIndicator: this.settings.calendarSettings.currentTimeLine,
                editable: false, selectable: true, events: jsonObj,
                eventTextColor: this.settings.events.fontColor, eventBorderColor: this.settings.events.borderColor,
                eventRender: (event: any, element: any) => {
                    element.attr("id", event.id);
                    let className: string;
                    if (eventGroupFlag) { className = thisObj.encodeData(event.group); }
                    else { className = thisObj.encodeData(event.title); }
                    element.attr('title', `${event.title}`);
                    element.addClass(className);
                    element.addClass('event');
                    if (!eventURLFlag || !(this.settings.url.show)) {
                        element.on('click', (d: any) => {

                            let id = Number(d.currentTarget.id);;
                            thisObj.selectionManager.select(calendarSelectionId[id]).then((ids: ISelectionId[]) => {
                                d3.selectAll('.event').style('opacity', ids.length > 0 ? 0.5 : 1);
                                d3.select(d.currentTarget).style('opacity', 1);
                                d.stopPropagation();
                            });
                        });
                    }
                },
                eventClick: function (calEvent, jsEvent, view) {
                    if (thisObj.settings.url.show) {
                        thisObj.host.launchUrl(calEvent.url);
                    }
                }
            });
            let events = d3.selectAll('.event')[0];
            events.forEach((e, i): any => {
                var test = $(e).attr('id');
                var selectionID = calendarSelectionId[test];
                e["__data__"] = selectionID;
            });
            if (visualWidth > 1200) {
                this.handleFontSettings();
            }
            else if (visualWidth > 500) {
                this.handleFontSettingsMin();
            }
            else {
                this.handleFontSettingsMin1();
            }
            this.customFormat();
            if (this.locale === 'ar-SA') { d3.select('#dashboard').selectAll('.fc-content').style('text-align', 'right'); }
            d3.select('.fc-month-button').on('click', () => { thisObj.calendarView = 'month'; thisObj.persistView(); });
            d3.select('.fc-agendaWeek-button').on('click', () => { thisObj.calendarView = 'agendaWeek'; thisObj.persistView(); });
            d3.select('.fc-agendaDay-button').on('click', () => { thisObj.calendarView = 'agendaDay'; thisObj.persistView(); });
            d3.select('.fc-listMonth-button').on('click', () => { thisObj.calendarView = 'listMonth'; thisObj.persistView(); });
            d3.select('.fc-prev-button').on('click', () => {
                let date: any = $('.calendar').fullCalendar('getDate');
                let nowDate = new Date(date).toString();
                thisObj.persistedDate = nowDate; thisObj.persistDate();

            });
            d3.select('.fc-next-button').on('click', () => {
                let date: any = $('.calendar').fullCalendar('getDate');
                let nowDate = new Date(date).toString();
                thisObj.persistedDate = nowDate; thisObj.persistDate();

            });
            d3.select('.fc-today-button').on('click', () => { thisObj.persistedDate = 'today'; thisObj.persistDate(); });
        }
        public mapCurrentLocale(locale: string, localesList): string {
            if (localesList[locale]) {
                return locale;
            }
            else {
                let numberOfDash: number = locale.split('-').length - 1;
                for (let iterator: number = 0; iterator < numberOfDash; iterator++) {
                    locale = locale.substr(0, locale.lastIndexOf('-'));
                    if (localesList[locale]) {
                        return locale;
                    }
                }
            }
        }
        private handleLandingPage(options: VisualUpdateOptions): void {
            if (!options.dataViews || !options.dataViews.length) {
                if (!this.isLandingPageOn) {
                    this.isLandingPageOn = true;
                    const sampleLandingPage: Element = this.createsampleLandingPage();
                    this.landingPage = d3.select(".LandingPage");
                }
            } else {
                if (this.isLandingPageOn && !this.landingPageRemoved) {
                    this.landingPageRemoved = true;
                    this.landingPage.remove();
                }
            }
        }
        private handleFontSettings() {
            this.settings.events.fontSize = Math.max(8, this.settings.events.fontSize),
                this.settings.events.fontSize = Math.min(19, this.settings.events.fontSize),
                this.settings.fonts.fontSize = Math.max(8, this.settings.fonts.fontSize),
                this.settings.fonts.fontSize = Math.min(19, this.settings.fonts.fontSize),
                this.settings.fonts.textSize = Math.max(8, this.settings.fonts.textSize),
                this.settings.fonts.textSize = Math.min(19, this.settings.fonts.textSize)
        }
        private handleFontSettingsMin() {
            this.settings.events.fontSize = Math.max(8, this.settings.events.fontSize),
                this.settings.events.fontSize = Math.min(14, this.settings.events.fontSize),
                this.settings.fonts.fontSize = Math.max(8, this.settings.fonts.fontSize),
                this.settings.fonts.fontSize = Math.min(14, this.settings.fonts.fontSize),
                this.settings.fonts.textSize = Math.max(8, this.settings.fonts.textSize),
                this.settings.fonts.textSize = Math.min(14, this.settings.fonts.textSize)
        }
        private handleFontSettingsMin1() {
            this.settings.events.fontSize = Math.max(8, this.settings.events.fontSize),
                this.settings.events.fontSize = Math.min(10, this.settings.events.fontSize),
                this.settings.fonts.fontSize = Math.max(8, this.settings.fonts.fontSize),
                this.settings.fonts.fontSize = Math.min(10, this.settings.fonts.fontSize),
                this.settings.fonts.textSize = Math.max(8, this.settings.fonts.textSize),
                this.settings.fonts.textSize = Math.min(10, this.settings.fonts.textSize)
        }
        private customFormat() {
            d3.selectAll('.fc-title').style('font-size', this.settings.events.fontSize + 'px');
            d3.selectAll('.fc-title').style('font-family', this.settings.events.fontFamily);
            d3.selectAll('.fc-center').style('font-size', this.settings.fonts.fontSize + 'px');
            d3.selectAll('.fc-button-group').style('font-size', this.settings.fonts.textSize + 'px');
            d3.selectAll('.legendText').style('font-family', this.settings.legend.fontFamily);
        }
        private createsampleLandingPage(): Element {
            const page: any = d3.select(this.element)
                .append("div")
                .classed("LandingPage", true);
            page.append("text")
                .classed("landingPageHeader", true)
                .text("Calendar Visual by MAQ Software")
                .append("text")
                .classed("landingPageText", true)
                .text("Calendar Visual by MAQ Software is the most effective way to track events. This visual allows users to render events on specific days, which can be used as a reference during your report review");
            return page;
        }
        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
            let enumeration: VisualObjectInstance[]; enumeration = [];
            switch (options.objectName) {
                case 'legend':
                    if (!this.settings.legend.show) {
                        enumeration.push({
                            objectName: options.objectName,
                            displayName: 'Legends', selector: null,
                            properties: {
                                show: this.settings.legend.show
                            }
                        });
                    } else {
                        enumeration.push({
                            objectName: options.objectName,
                            displayName: 'Legends', selector: null,
                            properties: {
                                show: this.settings.legend.show,
                                position: this.settings.legend.position,
                                labelColor: this.settings.legend.labelColor,
                                fontSize: this.settings.legend.fontSize,
                                fontFamily: this.settings.legend.fontFamily
                            }
                        });
                    }
                    break;
                case 'url':
                    if (eventURLFlag) {
                        enumeration.push({
                            objectName: options.objectName,
                            displayName: 'URL Navigate', selector: null,
                            properties: {
                                show: this.settings.url.show
                            }
                        });
                    }
                    break;
                case 'events':
                    enumeration.push({
                        objectName: options.objectName,
                        displayName: 'Event fields', selector: null,
                        properties: {
                            fontColor: this.settings.events.fontColor,
                            borderColor: this.settings.events.borderColor,
                            fontSize: this.settings.events.fontSize,
                            fontFamily: this.settings.events.fontFamily
                        }
                    });
                    break;
                case 'fonts':
                    enumeration.push({
                        objectName: options.objectName,
                        displayName: 'Font fields', selector: null,
                        properties: {
                            fontSize: this.settings.fonts.fontSize,
                            textSize: this.settings.fonts.textSize
                        }
                    });
                    break;
                case 'buttons':
                    enumeration.push({
                        objectName: options.objectName, selector: null,
                        properties: {
                            week: this.settings.buttons.week,
                            day: this.settings.buttons.day,
                            list: this.settings.buttons.list
                        }
                    });
                    break;
                case 'workHours':
                    enumeration.push({
                        objectName: options.objectName,
                        selector: null,
                        properties: {
                            startTime: this.settings.workHours.startTime,
                            endTime: this.settings.workHours.endTime
                        }
                    });
                    break;
                case 'workDays':
                    enumeration.push({
                        objectName: options.objectName,
                        selector: null,
                        properties: {
                            weekendSunday: this.settings.workDays.weekendSunday,
                            weekdayMonday: this.settings.workDays.weekdayMonday,
                            weekdayTuesday: this.settings.workDays.weekdayTuesday,
                            weekdayWednesday: this.settings.workDays.weekdayWednesday,
                            weekdayThursday: this.settings.workDays.weekdayThursday,
                            weekdayFriday: this.settings.workDays.weekdayFriday,
                            weekendSaturday: this.settings.workDays.weekendSaturday
                        }
                    });
                    break;
                case 'calendarSettings':
                    enumeration.push({
                        objectName: options.objectName,
                        selector: null,
                        properties: {
                            startingWeekDay: this.settings.calendarSettings.startingWeekDay,
                            currentTimeLine: this.settings.calendarSettings.currentTimeLine,
                            navLink: this.settings.calendarSettings.navLink,
                            weekNumber: this.settings.calendarSettings.weekNumber,
                            rtl: this.settings.calendarSettings.rtl
                        }
                    });
                    break;
                case 'colorSelector':
                    for (let index: number = 0; index < colorLegend.length; index++) {
                        enumeration.push({
                            objectName: options.objectName,
                            displayName: colorLegend[index].keyName,
                            properties: {
                                fillColor: colorLegend[index].color
                            },
                            selector: colorLegend[index].selectionId.getSelector()
                        });
                    }
                    break;
                default:
            }
            return enumeration;
        }
    }
}