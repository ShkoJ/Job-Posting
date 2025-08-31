const app = Vue.createApp({
    data() {
        return {
            jobs: [], 
            showToBePostedOnly: true,
            currentPage: 1,
            pageSize: 10,
            totalJobs: 0,
            sortOrder: 'asc', 
            searchQuery: '',
            isScheduledView: false
        };
    },
    computed: {
        filteredJobs() {
            // The API handles filtering, so this is just a direct return
            return this.jobs;
        },
        sortButtonText() {
            return this.sortOrder === 'asc' ? 'Sort by Oldest' : 'Sort by Newest';
        },
        currentSectionTitle() {
            if (this.isScheduledView) {
                return 'Scheduled Jobs Queue ⏰';
            }
            return this.showToBePostedOnly ? 'Jobs To Be Posted' : 'Posted Jobs (Archived)';
        },
        totalPages() {
            return Math.ceil(this.totalJobs / this.pageSize);
        }
    },
    watch: {
        searchQuery: function(newVal, oldVal) {
            this.currentPage = 1;
            this.debouncedFetchJobs();
        }
    },
    created() {
        this.debouncedFetchJobs = this.debounce(this.fetchJobs, 500);
    },
    methods: {
        debounce(func, delay) {
            let timeout;
            return function(...args) {
                const context = this;
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(context, args), delay);
            };
        },
        async fetchJobs() {
            try {
                this.isScheduledView = false;
                const status = this.showToBePostedOnly ? 'active' : 'archived';
                const skip = (this.currentPage - 1) * this.pageSize;
                const limit = this.pageSize;
                const response = await fetch(`http://localhost:8000/jobs?status=${status}&skip=${skip}&limit=${limit}&order=${this.sortOrder}&search=${this.searchQuery}`);
                const countResponse = await fetch(`http://localhost:8000/jobs/count?status=${status}&search=${this.searchQuery}`);

                if (!response.ok || !countResponse.ok) {
                    throw new Error('Failed to fetch jobs.');
                }

                this.jobs = await response.json();
                const countData = await countResponse.json();
                this.totalJobs = countData.total;
                document.querySelector('.table-header').style.gridTemplateColumns = '2fr 1.5fr 1fr 2fr';
                document.querySelectorAll('.table-row').forEach(el => el.style.gridTemplateColumns = '2fr 1.5fr 1fr 2fr');

            } catch (error) {
                this.jobs = []; // Clear jobs on error
                console.error("Error fetching jobs:", error);
            }
        },
        async fetchScheduledJobs() {
            try {
                const response = await fetch('http://localhost:8000/scheduled-jobs');
                if (!response.ok) {
                    throw new Error('Failed to fetch scheduled jobs.');
                }
                const data = await response.json();
                this.jobs = data;
                this.totalJobs = this.jobs.length;
                this.isScheduledView = true;
                this.searchQuery = '';
                // Adjusting the grid layout for the scheduled view
                document.querySelector('.table-header').style.gridTemplateColumns = '2fr 1.5fr 1fr 1.5fr 2fr';
                document.querySelectorAll('.table-row').forEach(el => el.style.gridTemplateColumns = '2fr 1.5fr 1fr 1.5fr 2fr');

            } catch (error) {
                this.jobs = [];
                console.error('Error fetching scheduled jobs:', error);
            }
        },
        toggleJobFilter(showToBePosted) {
            this.showToBePostedOnly = showToBePosted;
            this.currentPage = 1; 
            this.isScheduledView = false;
            this.fetchJobs();
        },
        toggleSortOrder() {
            this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
            this.currentPage = 1; 
            this.fetchJobs();
        },
        async postToTelegram(job) {
            try {
                const response = await fetch(`http://localhost:8000/jobs/${job.id}/post_and_schedule`, {
                    method: 'POST'
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to schedule job for Telegram.');
                }
                const data = await response.json();
                this.showToast(`Job '${job.title}' scheduled for Telegram at ${data.scheduled_time}.`);
                
                // Immediately remove job from the list to update the UI
                const jobIndex = this.jobs.findIndex(j => j.id === job.id);
                if (jobIndex !== -1) {
                    this.jobs.splice(jobIndex, 1);
                    this.totalJobs--;
                }
            } catch (error) {
                console.error('Error scheduling job for Telegram:', error);
                this.showToast(`Error: ${error.message}`, 'error');
            }
        },
        async copyTemplate(job) {
            // Your existing copy logic
            const location_tag = job.location.replace(' ', '');
            const hashtags = `\u200f#\u200f${location_tag} #\u200fHiring #\u200fVacancy #\u200fJobsIn${location_tag}`;

            const template = (
                `\u200fهەلی کار بۆ ئێوە لە شاری ${job.location}!\n\n` +
                `${job.company} پێویستی بە کارمەند هەیە بۆ ${job.title} بۆ ئەوەی ببێت بە بەشێک لە تیمەکە.\n` +
                `📍${job.location}\n` +
                `بۆ پێشکەشکردن و زانیاری زیاتر تکایە سەردانی ماڵپەری JOBS KRD بکەن\n\n` +
                "____\n\n" +
                `${job.company} is looking for a ${job.title} to join the team\n` +
                `📍${job.location}\n` +
                "Interested candidates can register and apply through JOBS KRD website\n\n" +
                "____\n\n" +
                `\u200f${job.company} تبحث عن موظفة لمنصب ${job.arabic_job_title} للانضمام إلى الفريق.\n` +
                `📍${job.location}\n` +
                "يمكن للمرشحات المهتمات التسجيل والتقديم من خلال موقع JOBS KR" +
                `\n\n${hashtags}`
            );
            
            if (template) {
                try {
                    await navigator.clipboard.writeText(template);
                    this.showToast('Template copied to clipboard!', 'success');
                    await this.markJobAsPosted(job.id);
                } catch(err) {
                    console.error('Failed to copy text: ', err);
                }
            }
        },
        async archiveJob(job) {
            try {
                await this.markJobAsPosted(job.id);
                this.showToast(`Job '${job.title}' has been moved to Posted.`, 'info');
                const jobIndex = this.jobs.findIndex(j => j.id === job.id);
                if (jobIndex !== -1) {
                    this.jobs.splice(jobIndex, 1);
                    this.totalJobs--;
                }
            } catch (error) {
                this.showToast(`Error archiving job: ${error.message}`, 'error');
            }
        },
        async markJobAsPosted(jobId) {
            try {
                const response = await fetch(`http://localhost:8000/jobs/${jobId}/mark_as_posted`, {
                    method: 'POST'
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to mark job as posted.');
                }
            } catch (error) {
                console.error('Error marking job as posted:', error);
                throw error; // Re-throw to be caught by the caller
            }
        },
        async removeScheduledJob(jobId) {
            try {
                const response = await fetch(`http://localhost:8000/scheduled-jobs/${jobId}`, {
                    method: 'DELETE'
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to remove job from queue.');
                }
                this.showToast('Job removed from queue and returned to active list.', 'success');
                this.fetchScheduledJobs(); // Refresh the list
            } catch (error) {
                console.error('Error removing job from queue:', error);
                this.showToast(`Error: ${error.message}`, 'error');
            }
        },
        async simulateDailyReport() {
            try {
                const response = await fetch('http://localhost:8000/trigger-daily-report', {
                    method: 'POST'
                });
                const data = await response.json();
                this.showToast(data.message);
            } catch (error) {
                console.error('Error simulating daily report:', error);
            }
        },
        nextPage() {
            if (this.currentPage < this.totalPages) {
                this.currentPage++;
                this.fetchJobs();
            }
        },
        previousPage() {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.fetchJobs();
            }
        },
        formatScheduledTime(isoString) {
            const date = new Date(isoString);
            return date.toLocaleString(); // Use the browser's locale for a friendly format
        },
        showToast(message, type = 'default') {
            const toastContainer = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.textContent = message;
            
            toastContainer.appendChild(toast);
            
            // Trigger the animation
            setTimeout(() => {
                toast.classList.add('show');
            }, 10);

            // Hide the toast after 4 seconds
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 400); // Remove element after transition
            }, 4000);
        }
    },
    mounted() {
        this.fetchJobs();
    }
});

app.mount('#app');
