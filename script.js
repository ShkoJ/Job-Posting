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
            return this.jobs;
        },
        filterButtonText() {
            return this.showToBePostedOnly ? 'Show Posted Jobs' : 'Show To be Posted Jobs';
        },
        currentSectionTitle() {
            if (this.isScheduledView) {
                return 'Scheduled Jobs Queue';
            }
            return this.showToBePostedOnly ? 'Jobs To Be Posted' : 'Posted Jobs (Archived)';
        },
        totalPages() {
            return Math.ceil(this.totalJobs / this.pageSize);
        },
        sortButtonText() {
            return this.sortOrder === 'asc' ? 'Sort by Newest' : 'Sort by Oldest';
        }
    },
    watch: {
        searchQuery: function(newVal, oldVal) {
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

            } catch (error) {
                console.error("Error fetching jobs:", error);
            }
        },
        async fetchScheduledJobs() {
            try {
                const response = await fetch('http://localhost:8000/scheduled-jobs');
                if (!response.ok) {
                    throw new Error('Failed to fetch scheduled jobs.');
                }
                this.jobs = await response.json();
                this.totalJobs = this.jobs.length;
                this.isScheduledView = true;
                this.searchQuery = '';
            } catch (error) {
                console.error('Error fetching scheduled jobs:', error);
            }
        },
        toggleJobFilter() {
            this.showToBePostedOnly = !this.showToBePostedOnly;
            this.currentPage = 1; 
            this.isScheduledView = false;
            this.fetchJobs();
        },
        toggleSortOrder() {
            if (this.isScheduledView) {
                // Sort scheduled jobs by time
                this.jobs.sort((a, b) => {
                    const dateA = new Date(a.scheduled_time);
                    const dateB = new Date(b.scheduled_time);
                    return this.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
                });
            } else {
                this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
                this.currentPage = 1; 
                this.fetchJobs();
            }
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
                alert(`Job '${job.title}' scheduled for Telegram at ${data.scheduled_time}.`);
                
                const jobIndex = this.jobs.findIndex(j => j.id === job.id);
                if (jobIndex !== -1) {
                    this.jobs.splice(jobIndex, 1);
                    this.totalJobs--;
                }

                this.fetchJobs();
            } catch (error) {
                console.error('Error scheduling job for Telegram:', error);
                alert(`Error: ${error.message}`);
            }
        },
        async copyTemplate(job) {
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
                    alert('Template copied to clipboard!');
                    await this.markJobAsPosted(job.id);
                } catch(err) {
                    console.error('Failed to copy text: ', err);
                }
            }
        },
        async archiveJob(job) {
            await this.toggleJobStatus(job.id, 'archived');
        },
        async toggleJobStatus(jobId, newStatus) {
            try {
                const job = this.jobs.find(j => j.id === jobId);
                if (!job) return;
                
                if (newStatus === 'archived') {
                    await this.markJobAsPosted(jobId);
                    alert(`Job '${job.title}' has been moved to Posted.`);

                    const jobIndex = this.jobs.findIndex(j => j.id === jobId);
                    if (jobIndex !== -1) {
                         this.jobs.splice(jobIndex, 1);
                         this.totalJobs--;
                    }
                } else {
                    alert(`Job '${job.title}' has been moved to Not Posted.`);
                }
                this.fetchJobs(); 
            } catch (error) {
                console.error("Error toggling job status:", error);
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
            }
        },
        async removeScheduledJob(jobId) {
            try {
                const response = await fetch(`http://localhost:8000/scheduled-jobs/${jobId}`, {
                    method: 'DELETE'
                });
                if (!response.ok) {
                    throw new Error('Failed to remove job from queue.');
                }
                alert('Job removed from queue and returned to active list.');
                this.fetchScheduledJobs(); // Refresh the list
            } catch (error) {
                console.error('Error removing job from queue:', error);
                alert(`Error: ${error.message}`);
            }
        },
        async simulateDailyReport() {
            try {
                const response = await fetch('http://localhost:8000/trigger-daily-report', {
                    method: 'POST'
                });
                const data = await response.json();
                alert(data.report || data.message);
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
        }
    },
    mounted() {
        this.fetchJobs();
    }
});

app.mount('#app');