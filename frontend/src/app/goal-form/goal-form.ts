import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../api-error';
import { GoalsService } from '../goals.service';
import { GOAL_STATUSES, type GoalDraft, type GoalStatus } from '../models';

/** The API trims before validating, so "   " is not a title here either. */
function nonBlank(control: AbstractControl): ValidationErrors | null {
  return typeof control.value === 'string' && control.value.trim() === '' ? { blank: true } : null;
}

@Component({
  selector: 'app-goal-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './goal-form.html',
  styleUrl: './goal-form.css',
})
export class GoalForm {
  private readonly goalsService = inject(GoalsService);
  private readonly router = inject(Router);

  protected readonly statuses = GOAL_STATUSES;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, nonBlank, Validators.maxLength(200)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(2000)],
    }),
    targetDate: new FormControl('', { nonNullable: true }),
    status: new FormControl<GoalStatus>('active', { nonNullable: true }),
  });

  protected get title(): FormControl<string> {
    return this.form.controls.title;
  }

  protected get description(): FormControl<string> {
    return this.form.controls.description;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { title, description, targetDate, status } = this.form.getRawValue();
    // Empty inputs go as null, not '': the API rejects targetDate: '' with a 400,
    // and null is how it represents "no value".
    const draft: GoalDraft = {
      title: title.trim(),
      description: description.trim() === '' ? null : description.trim(),
      targetDate: targetDate === '' ? null : targetDate,
      status,
    };

    this.saving.set(true);
    this.error.set(null);
    this.goalsService.create(draft).subscribe({
      next: (goal) => {
        void this.router.navigate(['/goals', goal.id]);
      },
      error: (err: unknown) => {
        this.error.set(apiErrorMessage(err));
        this.saving.set(false);
      },
    });
  }
}
