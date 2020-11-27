module powerbi.extensibility.visual {
  'use strict';
  import DataViewObjectsParser = powerbi.extensibility.utils.dataview.DataViewObjectsParser;

  export class VisualSettings extends DataViewObjectsParser {

    public legend: LegendSettings = new LegendSettings();
    public url: URLSettings = new URLSettings();
    public colorSelector: ColorSelector = new ColorSelector();
    public events: EventSettings = new EventSettings();
    public fonts: FontSettings = new FontSettings();
    public buttons: ButtonSettings = new ButtonSettings();
    public calendarSettings: CalendarSettings = new CalendarSettings();
    public workHours: WorkHours = new WorkHours();
    public workDays: WorkDays = new WorkDays();
    public persistCalendarView: PersistCalendarView = new PersistCalendarView();
    public persistCalendarDate: PersistCalendarDate = new PersistCalendarDate();
    public caption: CaptionValues = new CaptionValues();
  }
  export class CaptionValues {
    public captionValue: string = '{}';
  }

  export class LegendSettings {
    public show: boolean = true;
    public position: string = 'Top';
    public labelColor: string = '#000000';
    public fontSize: number = 9;
    public fontFamily: string = 'Arial';
  }
  export class URLSettings {
    public show: boolean = false;
  }
  // tslint:disable-next-line:max-classes-per-file
  export class ColorSelector {
    public fill: string = '#ffffff';
  }

  // tslint:disable-next-line:max-classes-per-file
  export class EventSettings {
    public fontColor: string = '#ffffff';
      public borderColor: string = '#cccccc';
      public fontSize: number = 15;
      public fontFamily: string = 'Arial';
  }

  // tslint:disable-next-line:max-classes-per-file
  export class FontSettings {

      public fontSize: number = 15;
      public textSize: number = 15;

    }

  // tslint:disable-next-line:max-classes-per-file
  export class ButtonSettings {
    public month: boolean = true;
    public week: boolean = true;
    public day: boolean = true;
    public list: boolean = true;
  }

  // tslint:disable-next-line:max-classes-per-file
  export class WorkHours {
    public startTime: string = '09:00';
    public endTime: string = '17:00';
  }

  // tslint:disable-next-line:max-classes-per-file
  export class WorkDays {
    public weekdayMonday: boolean = true;
    public weekdayTuesday: boolean = true;
    public weekdayWednesday: boolean = true;
    public weekdayThursday: boolean = true;
    public weekdayFriday: boolean = true;
    public weekendSaturday: boolean = false;
    public weekendSunday: boolean = false;
  }

  // tslint:disable-next-line:max-classes-per-file
  export class CalendarSettings {
    public startingWeekDay: string = 'Sunday';
    public currentTimeLine: boolean = true;
    public navLink: boolean = true;
    public weekNumber: boolean = false;
    public rtl: boolean = false;
  }

  // tslint:disable-next-line:max-classes-per-file
  export class PersistCalendarView {
    public calendarView: string = 'month';
  }

  // tslint:disable-next-line:max-classes-per-file
  export class PersistCalendarDate {
    public persistedDate: string = '';
  }
}
