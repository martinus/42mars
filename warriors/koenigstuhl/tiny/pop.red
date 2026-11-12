;redcode-tiny
;name Pop!
;author Neogryzor
;assert CORESIZE==800
;strategy Ten minutes 0.8c oneshot scanner
;strategy tweaked a bit

	step equ 16

loop:	sub.f inc,scan
scan:	sne.i 23,15
	sub.f inc,scan
	sne.i *scan,@scan
	djn loop,{loop-66
inc:	spl #-step,-step
clr:	mov @bpt,>scan
	mov @bpt,>scan
	mov @bpt,>scan
bpt:	djn.f clr+1,{sbm
	dat loop-1,2-scan
dbm:	dat loop-1,2-scan
sbm:	spl #loop-42,1-scan
for 4
	dat 0,0
rof
start:	mov <loop-89,{loop-91	;oneshot decoy
	mov <loop-90,<loop-92
	djn.f scan,{loop-94

	end start

