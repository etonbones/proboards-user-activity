(function () {
	const route = pb.data('route');
	const settings = proboards.plugin._plugins['filter_user_activity']?pb.plugin.get('filter_user_activity').settings : {};
	let moreAdded = false, no_user_id = 9999991;
	if ((settings.profile_tabs||['show_user_activity','show_user_following','show_user_notifications']).indexOf(route.name) !== -1 /*route.name === 'show_user_activity' || route.name === 'show_user_following' || route.name === 'show_user_notifications'*/) {
		$(function () {
			const $activities_container = $('.activities-container, .notifications-container');
			const $filter_container = $('<div/>').appendTo($('<thead \/>').insertBefore($activities_container).append($activities_container.find('tr:first td').clone().empty()).find('.main'));
			let $filter ;

			function createFilter(action_index, user_index, work_set) {
				var verb = {}, users = {}
				$activities_container.find('tr').each(function (i, e) {
					let txt = $('.italic',e);					
					let user = $('.user-link,[itemtype*="schema.org/Person"]',e); 
					if(user.length==0 )return;
					user=user.eq(0);
					//The newly relocated bookmark notifications forgot the italics class on the verb so add one
					//User name may use span[itemtype] wrapping user-link so do not unwrap user-link just yet since we need the nextsibling
					if(txt.length ===0 ){ 
						let tmp = user[0].nextSibling;
						txt = $('<span class="italic" />').insertBefore(tmp).hide().text(tmp.textContent.trim().split(/\s+/)[0])
					}
					//unwrap
					user.hasClass('user-link')|| (user=user.find('.user-link, .user-deleted'));
					//deleted users have no user_id so use a counter with sufficient upper room  for actual users (9 million+)
					if(user.hasClass('user-deleted')){ let tmp;
						if( (tmp = $('.user-deleted[title="@'+user.text()+'"]')).length === 0){
							user.attr('title','@'+user.text()).addClass('user-' + no_user_id++);
						}else{
							user.attr('title', tmp.eq(0).attr('title')).addClass('user-'+tmp.eq(0).idFromClass('user'));
						}
					}
					//notifications have no activity classes
					let tr = $(e);
					tr.hasClass('activity-item') || tr.addClass('activity-item activity-'+i);
					
					txt = txt.text().split(/\s+/);
					//allow for complementary verbs
					/^(was|has)$/.test(txt[0]) && (txt[0] = (txt[0] + " " + txt[1]));
					txt=txt[0];
					verb[txt] = (verb[txt] || []);
					verb[txt].push('.activity-' + tr.idFromClass('activity'));
					/* Deleted users only have a span not a link with user-x class*/
					if(user.idFromClass('user') != route.params.user_id ){
						users[user[0].title+'!'+user.text()] = users[user[0].title+'!'+user.text()] || [];
						users[user[0].title+'!'+user.text()].push('.activity-' + tr.idFromClass('activity'))
					}
				})
				function transposeTimeUnit(perdayval){
					const u = [[7,'weekly'],[52,'yearly'],[10,'decade'],[10,'century']];
					let i=0
					if (perdayval > 0 && perdayval < 1){						
						while(perdayval<1 && i<u.length){
							perdayval *= u[i++][0];
						}
					}
					if(perdayval>5 && i && u[i-1][1] === 'yearly') {perdayval = perdayval/12; i=u.push([1,'monthly'])}
					return {value: perdayval, unit: i?'<b class="activity-average-unit">'+u[i-1][1]+'</b>':'<b class="activity-average-unit">daily</b>'}
				}
				var $sel = $('<select  class="action-filter" style="order:2;flex-basis:30%;"><option>All Activities<\/option><option>' + Object.keys(verb).join('<\/option><option>') + '<\/option><\/select>');
				$sel.find('option').each((i, e) => {
					e.value = $(e).text();
					action_index && action_index === i && (e.selected = true);
					action_index && action_index === e.value && (e.selected = true)
				})
				$sel.on('change', function () {
					const now = +new Date;
					const showing = ("undefined" !== typeof $selu) ? (users[$selu.val()]||['.activity-item']).join(',') : '.activity-item';
					let calc = document.querySelector('.activity-calc') || $('<span style="order:3;flex-basis:40%;flex-grow:3;margin-left:.6em"/>')
					.insertAfter(this).get();
					calc.jquery || (calc = $(calc));
					calc.text('');
					calc.attr('class','activity-calc');
					
					if (this.options.selectedIndex === 0) {
						$('.activity-item').filter(showing).show();
					} else {
						$('.activity-item').hide();
						//show stats next to selected verbs (e.g. "posted 5 times in the past week", "liked posts on a average of 10 per month")
						let oldest_time = $(verb[this.value.trim()].join(',')).filter(showing).show()
						.last().find('.time-container abbr').data('timestamp');
						const visible = $('.activity-item:visible').length;
						if(settings.statistics !== 'disable' && !/(registered)/.test($sel.val()) && ("undefined" == typeof $selu || $selu.prop('selectedIndex')>0) && oldest_time !== void(0)){
							let units = transposeTimeUnit($('.activity-item:visible').length/((now - oldest_time)/1000/3600/24))
							//choose which form of stat to show based on number of days in plugin settings and whether "show more" link was clicked
							if(((now - oldest_time)/1000/3600/24) < (settings.avg_threshold||30) || visible < (settings.min_threshold||3) || !moreAdded){
								calc.html( (visible===1 ? visible + ' time' : visible + ' times') +' since <abbr class="o-timestamp time" data-timestamp="' + oldest_time + '">' + new Date(oldest_time) + '<\/abbr>' ).addClass('activity-calc activity-'+$sel.val().replace(/\W/g,'_'));
							}else{
							calc.html( ' on a '+units.unit+' average pace of <b class="activity-average-calc" title="'+$('.activity-item:visible').length+' samples">'+Number(units.value).toFixed(2)+'</b> since <abbr class="o-timestamp time" data-timestamp="' + oldest_time + '">' + new Date(oldest_time) + '<\/abbr>').addClass('activity-calc activity-perday activity-'+$sel.val().replace(/\W/g,'_'));
							}
						}
					}
					
				})
				if(Object.keys(users).length){
					var $selu = $('<select class="user-filter" style="order:1;flex-basis:30%;"><option>All Users<\/option><option>' + Object.keys(users).join('<\/option><option>') + '<\/option><\/select>');
					$selu.find('option').each((i, e) => {
						e.value = $(e).text();
						e.textContent.indexOf('!') >0 && (e.textContent = e.textContent.split('!')[1]);
						user_index && user_index === i && (e.selected = true);
						user_index && user_index === e.value && (e.selected = true)
					})
					$selu.on('change', function () {
						const showing = ("undefined" !== typeof $sel) ? (verb[$sel.val()]||['.activity-item']).join(',') : '.activity-item'
						if (this.options.selectedIndex === 0) {
							$('.activity-item').filter(showing).show();							
						} else {
							$('.activity-item').hide();
							$(users[this.value].join(',')).filter(showing).show()
						}
						$filter.find('.action-filter').triggerHandler('change');
					})
				}
				
				return $('<div style="display:flex"  class="activity-filter"></div>').append($sel.add("undefined" !== typeof $selu ? $selu : ''))
			}
			
			//create the filter
			$filter_container.html("").append(($filter=createFilter()))
			
			//listen for added activities
			$('.show-more').on('click', function(){$(this).setStatus('Updating...')})
			pb.events.on(route.name === 'show_user_notifications' ? 'moreNotification' : 'moreActivity', function () {
				moreAdded = true;
				$filter_container.html("").append(($filter=createFilter($filter.find('.action-filter').val(),$filter.find('.user-filter').val())));
				$filter.find('.action-filter').triggerHandler('change');
				$filter.find('.user-filter').triggerHandler('change');
			})
			
			//listen for activities not covered by 'moreActivity' such as status change, delete, etc.
			let observer = new MutationObserver(function(mutations){
				$filter_container.html("").append(($filter=createFilter($filter.find('.action-filter').val(),$filter.find('.user-filter').val())));
				$filter.find('.action-filter').triggerHandler('change');
				$filter.find('.user-filter').triggerHandler('change');
			});
			observer.observe($activities_container[0],{attributes:false,childList:true,characterData:true})
		})
	}
})()
