import React from 'react';
import AppointmentCalendar from '../components/AppointmentCalendar';
import BusyHoursHeatmap from '../components/BusyHoursHeatmap';
import ReminderDispatch from '../components/ReminderDispatch';
import ApptConfirmPDF from '../components/ApptConfirmPDF';

export default function CustomViewsPage() {
  return (
    <div className="space-y-6" data-testid="custom-views-page">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Scheduler Views</h1>
        <p className="text-sm text-gray-500">Custom appointment views: calendar, heatmap, reminder dispatch, and confirmation PDF.</p>
      </div>

      <section data-testid="section-calendar">
        <AppointmentCalendar />
      </section>

      <section data-testid="section-heatmap">
        <BusyHoursHeatmap />
      </section>

      <section data-testid="section-reminders">
        <ReminderDispatch />
      </section>

      <section data-testid="section-pdf">
        <ApptConfirmPDF />
      </section>
    </div>
  );
}
