;redcode-tiny
;name six minutes
;author Neogryzor
;assert CORESIZE==800
;strategy 0.8c oneshot

	step equ 14

loop:	sub.f inc,scan
scan:	sne.i 22,15
	sub.f inc,scan
	sne.i *scan,@scan
	djn.f loop,{loop-80
inc:	spl #-step,-step
clr:	mov @bpt,>scan
	mov @bpt,>scan
	mov @bpt,>scan
bpt:	djn.f clr,{sbm
	dat loop-1,2-scan
dbm:	dat loop-1,2-scan
sbm:	spl #loop-42,1-scan

	end scan
