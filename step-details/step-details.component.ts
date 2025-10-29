import { Component, OnInit, HostListener } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule, DatePipe } from '@angular/common';
import { LoaderComponent } from '../../../shared/loader/loader.component';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { DataService } from '../../service/data.service';
import { DropdownModule } from 'primeng/dropdown';
import { FormatDataTimePipe } from '../../../data/pipe/format-date-time.pipe';
import { Step, StepperComponent } from '../../../shared/stepper/stepper.component';
import { WORKFLOWS } from '../../../data/workflow.config';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

@Component({
  selector: 'app-step-details',
  standalone: true,
  imports: [
    NgbModule,
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    DropdownModule,
    LoaderComponent,
    FormatDataTimePipe,
    StepperComponent,
    MatIconModule
  ],
  providers: [FormatDataTimePipe, DatePipe],
  templateUrl: './step-details.component.html',
  styleUrl: './step-details.component.scss'
})
export class StepDetailsComponent implements OnInit {

  isSubmitted: boolean = false;
  isLoading: boolean = false;

  processRefId: string = '';
  workItem: string = '';
  steps: any[] = [];
  sourceRefId: string = '';

  showDocumentPopup: boolean = false;
  isEditMode: boolean = false;
  availableDocuments: string[] = [];
  selectedSourceDocument: string = '';
  selectedTargetDocuments: string[] = [];
  modelDestinationLob: string = '';
  lobOptions: string[] = ["AUTOB","CGL","CYBER","DO","EO","EXCESS","PROP","UMBRC","WORK"];

  // Document viewer
  showDocumentViewer: boolean = false;
  selectedDocumentForView: string = '';
  documentViewerUrl: SafeResourceUrl | null = null;
  isLoadingDocument: boolean = false;

  // Draggable window properties
  isMaximized: boolean = false;
  isMinimized: boolean = false;
  isDragging: boolean = false;
  isResizing: boolean = false;
  
  windowPosition = { x: 100, y: 100 };
  windowSize = { width: 1200, height: 700 };
  dragOffset = { x: 0, y: 0 };
  resizeStart = { x: 0, y: 0, width: 0, height: 0 };

  // Docs panel collapse
  isDocsPanelCollapsed: boolean = false;

  // Chat interface
  chatMessages: ChatMessage[] = [];
  chatInput: string = '';
  isSendingMessage: boolean = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private dataService: DataService,
    private toastr: ToastrService,
    private formatDateTimePipe: FormatDataTimePipe,
    private sanitizer: DomSanitizer
  ) { }

  workFlow: Step[] = [];

  // Draggable window methods
  startDragging(event: MouseEvent) {
    if (this.isMaximized) return;
    
    this.isDragging = true;
    this.dragOffset.x = event.clientX - this.windowPosition.x;
    this.dragOffset.y = event.clientY - this.windowPosition.y;
    
    event.preventDefault();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (this.isDragging) {
      this.windowPosition.x = event.clientX - this.dragOffset.x;
      this.windowPosition.y = event.clientY - this.dragOffset.y;
      
      // Keep window within viewport
      const maxX = window.innerWidth - 300;
      const maxY = window.innerHeight - 100;
      
      this.windowPosition.x = Math.max(0, Math.min(this.windowPosition.x, maxX));
      this.windowPosition.y = Math.max(0, Math.min(this.windowPosition.y, maxY));
    }
    
    if (this.isResizing) {
      const deltaX = event.clientX - this.resizeStart.x;
      const deltaY = event.clientY - this.resizeStart.y;
      
      this.windowSize.width = Math.max(800, this.resizeStart.width + deltaX);
      this.windowSize.height = Math.max(500, this.resizeStart.height + deltaY);
    }
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    this.isDragging = false;
    this.isResizing = false;
  }

  startResizing(event: MouseEvent) {
    this.isResizing = true;
    this.resizeStart.x = event.clientX;
    this.resizeStart.y = event.clientY;
    this.resizeStart.width = this.windowSize.width;
    this.resizeStart.height = this.windowSize.height;
    
    event.preventDefault();
    event.stopPropagation();
  }

  toggleMaximize() {
    this.isMaximized = !this.isMaximized;
    
    if (this.isMaximized) {
      this.windowPosition = { x: 0, y: 0 };
      this.windowSize = { width: window.innerWidth, height: window.innerHeight };
    } else {
      this.windowPosition = { x: 100, y: 100 };
      this.windowSize = { width: 1200, height: 700 };
    }
  }

  minimizeWindow() {
    this.isMinimized = true;
  }

  restoreWindow() {
    this.isMinimized = false;
    if (!this.isMaximized) {
      this.windowPosition = { x: 100, y: 100 };
      this.windowSize = { width: 1200, height: 700 };
    }
  }

  toggleDocsPanel() {
    this.isDocsPanelCollapsed = !this.isDocsPanelCollapsed;
  }

  openDocumentAnalysis(step: any) {
    if (!this.processRefId) {
      this.toastr.error('Process reference ID is missing.');
      return;
    }

    const stepName = step.step_name || 'Document Analysis';
    const workItem = step.work_item || this.workItem;
    if (!workItem) {
      this.toastr.error('Work item is missing.');
      return;
    }

    if (!this.sourceRefId) {
      this.toastr.error('Source reference ID is missing.');
      return;
    }

    // Initialize LOB with workItem
    this.modelDestinationLob = workItem.toUpperCase();

    // Reset window state - open maximized
    this.isMaximized = true;
    this.isMinimized = false;
    this.isDocsPanelCollapsed = false;
    this.windowPosition = { x: 0, y: 0 };
    this.windowSize = { width: window.innerWidth, height: window.innerHeight };

    // Initialize chat with welcome message
    this.chatMessages = [
      {
        id: this.generateId(),
        text: 'Hello! I\'m your document assistant. Ask me anything about the documents or the analysis process.',
        sender: 'bot',
        timestamp: new Date()
      }
    ];

    this.isLoading = true;

    // Step 1: Get step fields (LOB, base, target docs)
    this.dataService.getEventStepFields(
      this.processRefId,
      stepName,
      'base_document,comparing_document,model_destination_lob'
    ).subscribe({
      next: (stepData: any) => {
        console.log('Step Data Response:', stepData);

        // --- LOB ---
        if (stepData?.model_destination_lob) {
          const apiLob = stepData.model_destination_lob.trim().toUpperCase();
          if (this.lobOptions.includes(apiLob)) {
            this.modelDestinationLob = apiLob;
          } else {
            console.warn(`LOB "${apiLob}" not allowed. Using fallback: ${this.modelDestinationLob}`);
            this.toastr.warning(`Invalid LOB "${apiLob}". Using default.`);
          }
        }

        // --- Base Document ---
        this.selectedSourceDocument = stepData?.base_document || '';

        // --- Target Documents ---
        if (stepData?.comparing_document) {
          const doc = stepData.comparing_document;
          if (Array.isArray(doc)) {
            this.selectedTargetDocuments = doc.length > 0 ? [...doc] : [''];
          } else if (typeof doc === 'string') {
            if (doc.trim() === '') {
              this.selectedTargetDocuments = [''];
            } else if (doc.includes(',')) {
              this.selectedTargetDocuments = doc.split(',')
                .map(d => d.trim())
                .filter(d => d !== '');
              if (this.selectedTargetDocuments.length === 0) this.selectedTargetDocuments = [''];
            } else {
              this.selectedTargetDocuments = [doc.trim()];
            }
          } else {
            this.selectedTargetDocuments = [''];
          }
        } else {
          this.selectedTargetDocuments = [''];
        }

        console.log('Final LOB:', this.modelDestinationLob);
        console.log('Selected Targets:', this.selectedTargetDocuments);

        // Step 2: Load available files using correct LOB
        this.dataService.getDocsFilesForEdit(
          this.sourceRefId,
          this.modelDestinationLob,
          this.workItem
        ).subscribe({
          next: (docsFiles: any) => {
            this.isLoading = false;
            console.log('Docs Files:', docsFiles);

            if (docsFiles?.status === 'success' && docsFiles.files) {
              this.availableDocuments = Array.isArray(docsFiles.files) ? docsFiles.files : [docsFiles.files];
            } else if (docsFiles?.files) {
              this.availableDocuments = Array.isArray(docsFiles.files) ? docsFiles.files : [docsFiles.files];
            } else {
              this.availableDocuments = [];
              this.toastr.warning('No documents available for editing.');
            }

            this.isEditMode = true;
            this.showDocumentPopup = true;

            if (this.availableDocuments.length === 0) {
              this.toastr.info('No documents found in the repository.');
            }
          },
          error: (error) => {
            this.isLoading = false;
            console.error('Error loading files:', error);
            this.toastr.error('Failed to load document list.');
          }
        });
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Error fetching step data:', error);
        const msg = error.status === 404 ? 'Document data not found.' :
                    error.status === 500 ? 'Server error.' : 'Failed to fetch data.';
        this.toastr.error(msg);
      }
    });
  }

  closeDocumentPopup() {
    this.showDocumentPopup = false;
    this.isEditMode = false;
    this.availableDocuments = [];
    this.selectedSourceDocument = '';
    this.selectedTargetDocuments = [];
    this.modelDestinationLob = '';
    this.isMaximized = false;
    this.isMinimized = false;
    this.isDocsPanelCollapsed = false;
    this.chatMessages = [];
    this.chatInput = '';
    this.closeDocumentViewer();
  }

  // Uses SAS URL from /document_viewer/
  viewDocument(documentName: string) {
    if (!documentName?.trim()) {
      this.toastr.error('Invalid document name.');
      return;
    }

    this.selectedDocumentForView = documentName;
    this.isLoadingDocument = true;
    this.showDocumentViewer = true;

    this.dataService.viewDoc(this.sourceRefId, documentName).subscribe({
      next: (res: { file_url: string }) => {
        this.isLoadingDocument = false;
        this.documentViewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(res.file_url);
      },
      error: (error) => {
        this.isLoadingDocument = false;
        console.error('Error loading document:', error);
        this.toastr.error('Failed to load document.');
        this.closeDocumentViewer();
      }
    });
  }

  closeDocumentViewer() {
    this.showDocumentViewer = false;
    this.selectedDocumentForView = '';
    this.documentViewerUrl = null;
  }

  getDocumentIcon(documentName: string): string {
    const ext = documentName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'picture_as_pdf';
      case 'doc': case 'docx': return 'description';
      case 'xls': case 'xlsx': return 'table_chart';
      case 'jpg': case 'jpeg': case 'png': case 'gif': return 'image';
      default: return 'insert_drive_file';
    }
  }

  addTargetDocument() {
    this.selectedTargetDocuments.push('');
  }

  removeTargetDocument(index: number) {
    this.selectedTargetDocuments.splice(index, 1);
  }

  saveDocumentChanges() {
    if (!this.selectedSourceDocument) {
      this.toastr.error('Please select a source document.');
      return;
    }

    const validTargets = this.selectedTargetDocuments.filter(d => d?.trim());
    if (validTargets.length === 0) {
      this.toastr.error('Please select at least one target document.');
      return;
    }

    this.isLoading = true;

    this.dataService.saveBaseTarget(
      this.sourceRefId,
      this.selectedSourceDocument,
      validTargets,
      this.workItem
    ).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.toastr.success(res?.status === 'success' ? 'Saved successfully.' : 'Documents saved.');
        this.closeDocumentPopup();
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Save error:', error);
        this.toastr.error('Failed to save changes.');
      }
    });
  }

  // Chat Methods
  sendChatMessage() {
    if (!this.chatInput.trim() || this.isSendingMessage) {
      return;
    }

    const userMessage: ChatMessage = {
      id: this.generateId(),
      text: this.chatInput.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    this.chatMessages.push(userMessage);
    const userQuery = this.chatInput.trim();
    this.chatInput = '';
    this.isSendingMessage = true;

    // TODO: Replace this with your actual API call
    // Example: this.dataService.sendChatMessage(userQuery, this.processRefId).subscribe(...)
    
    // Simulated bot response (replace with actual API)
    setTimeout(() => {
      const botMessage: ChatMessage = {
        id: this.generateId(),
        text: `I received your message: "${userQuery}". This is a placeholder response. Connect your backend API here.`,
        sender: 'bot',
        timestamp: new Date()
      };
      this.chatMessages.push(botMessage);
      this.isSendingMessage = false;
      this.scrollChatToBottom();
    }, 1000);
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private scrollChatToBottom() {
    setTimeout(() => {
      const chatContainer = document.querySelector('.chat-messages-area');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 100);
  }

  downloadChecklist() {
    if (!this.processRefId) {
      this.toastr.error('Process reference ID missing.');
      return;
    }
    this.isLoading = true;

    this.dataService.downloadChecklist(this.processRefId).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `final_${this.processRefId}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.isLoading = false;
        this.toastr.success('Checklist downloaded.');
      },
      error: (error) => {
        this.isLoading = false;
        const msg = error.status === 404 ? 'Checklist not generated yet.' : 'Download failed.';
        this.toastr.error(msg);
      }
    });
  }

  shouldShowDownloadButton(step: Step): boolean {
    return step.step?.toLowerCase().includes('generate checklist') && step.status === 'done';
  }

  private mapStepsToStepper(rawSteps: any[], workflowKey: string): Step[] {
    const workflowSteps = WORKFLOWS[workflowKey] || [];
    const stepsMap: { [key: string]: any } = {};
    rawSteps.forEach(s => s.step_name && (stepsMap[s.step_name.toLowerCase()] = s));

    const downloadStep = stepsMap['document download'];
    const metadataStep = stepsMap['extract metadata'];
    const classifyStep = stepsMap['document classification'];
    const analysisStep = stepsMap['document analysis'];
    const coiStep = stepsMap['send coi document'] ||
                   stepsMap['send coi documents'] ||
                   stepsMap['send coi doc'] ||
                   stepsMap['send coi'] ||
                   Object.values(stepsMap).find(s =>
                     s.step_name?.toLowerCase().includes('send') &&
                     s.step_name?.toLowerCase().includes('coi')
                   );

    const stepper: Step[] = [];

    if (['policy_checking', 'policy checking'].includes(workflowKey)) {
      workflowSteps.forEach(stepName => {
        let status: Step['status'] = 'pending';
        let message = '';

        switch (stepName.toLowerCase()) {
          case 'read input files':
            status = rawSteps.length === 0 || (downloadStep?.step_status?.toLowerCase() === 'in progress')
              ? 'inprogress' : 'done';
            message = status === 'inprogress' ? 'Reading files...' : 'Files read';
            break;
          case 'extract metadata':
            status = metadataStep?.step_status?.toLowerCase() === 'in progress' ? 'inprogress' :
                     metadataStep ? 'done' : (downloadStep ? 'inprogress' : 'pending');
            message = status === 'inprogress' ? 'Extracting...' : status === 'done' ? 'Complete' : 'Waiting';
            break;
          case 'classify documents':
            status = classifyStep?.step_status?.toLowerCase() === 'in progress' ? 'inprogress' :
                     classifyStep ? 'done' : 'pending';
            message = status === 'inprogress' ? (classifyStep.comments || 'Classifying') :
                      status === 'done' ? 'Complete' : 'Waiting';
            break;
          case 'generate checklist':
            status = analysisStep?.step_status?.toLowerCase() === 'in progress' ? 'inprogress' :
                     analysisStep ? 'done' : 'pending';
            message = status === 'inprogress' ? 'Generating...' : status === 'done' ? 'Complete' : 'Waiting';
            break;
          case 'upload checklist to target system':
            status = analysisStep && analysisStep.step_status?.toLowerCase() !== 'in progress' ? 'done' : 'pending';
            message = status === 'done' ? 'Uploaded' : 'Waiting';
            break;
          default:
            status = 'pending'; message = 'Pending';
        }
        stepper.push({ step: stepName, status, status_message: message });
      });
    } else if (workflowKey === 'coi') {
      workflowSteps.forEach(stepName => {
        let status: Step['status'] = 'pending';
        let message = '';

        switch (stepName.toLowerCase()) {
          case 'read input files':
            status = rawSteps.length === 0 || (downloadStep?.step_status?.toLowerCase() === 'in progress')
              ? 'inprogress' : 'done';
            message = status === 'inprogress' ? 'Reading...' : 'Complete';
            break;
          case 'extract metadata':
            status = analysisStep?.step_status?.toLowerCase() === 'in progress' ? 'inprogress' :
                     analysisStep ? 'done' : (downloadStep ? 'inprogress' : 'pending');
            message = status === 'inprogress' ? 'Extracting...' : status === 'done' ? 'Complete' : 'Waiting';
            break;
          case 'generate coi':
            status = coiStep?.step_status?.toLowerCase() === 'in progress' ? 'inprogress' :
                     coiStep ? 'done' : (analysisStep ? 'inprogress' : 'pending');
            message = status === 'inprogress' ? 'Generating...' : status === 'done' ? 'Complete' : 'Waiting';
            break;
          case 'email to requestor':
            status = coiStep && coiStep.step_status?.toLowerCase() !== 'in progress' ? 'done' : 'pending';
            message = status === 'done' ? (coiStep.comments || 'Sent') : 'Waiting';
            break;
          default:
            status = 'pending'; message = 'Pending';
        }
        stepper.push({ step: stepName, status, status_message: message });
      });
    } else {
      return this.mapGenericStepsToStepper(rawSteps, workflowSteps);
    }

    return stepper;
  }

  private mapGenericStepsToStepper(rawSteps: any[], workflowSteps: string[]): Step[] {
    const stepsMap: { [k: string]: any } = {};
    rawSteps.forEach(s => s.step_name && (stepsMap[s.step_name.toLowerCase()] = s));

    const stepper: Step[] = [];
    let inProgressFound = false;

    workflowSteps.forEach((step, i) => {
      const db = stepsMap[step.toLowerCase()];
      let status: Step['status'] = 'pending';
      let message = db?.comments || '';

      if (db) {
        const s = db.step_status?.toLowerCase();
        if (['completed', 'success'].includes(s)) status = 'done';
        else if (['in progress', 'processing'].includes(s)) { status = 'inprogress'; inProgressFound = true; }
        else if (['failed', 'error'].includes(s)) status = 'failed';
      } else if (!inProgressFound && i === 0) {
        status = 'inprogress'; inProgressFound = true;
      }

      stepper.push({ step, status, status_message: message });
    });

    return stepper;
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      this.processRefId = params.get('process_ref_id') || '';
      this.workItem = params.get('work_item')?.toLowerCase() || '';
      this.sourceRefId = params.get('source_id') || '';
      if (this.processRefId) this.loadSteps();
    });
  }

  loadSteps(): void {
    this.isLoading = true;
    this.steps = [];

    this.dataService.getEventSteps(this.processRefId).subscribe({
      next: (res: any) => {
        if (res?.status === 'error' || (Array.isArray(res) && res.length === 0)) {
          this.toastr.error('No step details available');
          this.steps = [];
        } else if (Array.isArray(res)) {
          this.steps = res;
          const key = this.workItem === 'policy checking' ? 'policy_checking' : this.workItem;
          this.workFlow = this.mapStepsToStepper(res, key);
        }
        this.isLoading = false;
      },
      error: () => {
        this.toastr.error('Event found with no steps yet');
        this.steps = [];
        this.isLoading = false;
      }
    });
  }

  getStatusBadge(status: string): { statusText: string; statusClass: string } {
    if (!status) return { statusText: 'No Status', statusClass: 'inactive' };
    const s = status.toLowerCase();
    const map: any = {
      'in progress': { statusText: 'In Progress', statusClass: 'pending' },
      'processing': { statusText: 'In Progress', statusClass: 'pending' },
      'completed': { statusText: 'Completed', statusClass: 'active' },
      'success': { statusText: 'Completed', statusClass: 'active' },
      'failed': { statusText: 'Failed', statusClass: 'inactive' },
      'error': { statusText: 'Failed', statusClass: 'inactive' },
      'pending': { statusText: 'Pending', statusClass: 'pending' }
    };
    return map[s] || { statusText: status, statusClass: 'default' };
  }

  getStatusIcon(status: string): string {
    if (!status) return 'help_outline';
    const s = status.toLowerCase();
    const map: any = {
      'in progress': 'hourglass_empty', 'processing': 'hourglass_empty',
      'completed': 'check_circle', 'success': 'check_circle',
      'failed': 'error', 'error': 'error', 'pending': 'schedule'
    };
    return map[s] || 'help_outline';
  }

  navigateBack() {
    const qp = { ...this.route.snapshot.queryParams };
    delete qp['process_ref_id']; delete qp['work_item'];
    this.router.navigate(['/layout/details'], { queryParams: qp });
  }

  onRefresh() {
    this.loadSteps();
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByMessageId(index: number, message: ChatMessage): string {
    return message.id;
  }
}