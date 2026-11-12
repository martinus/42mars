;redcode-94
;name Bigscan test1
;author Neogryzor
;assert CORESIZE==800
;strategy 0.8c bidirectional bishot scanner

	smod equ (11)
	step equ (smod*2)

loop:	add.f 2,scan	;inc,scan
scan:	sne.i loop-1-smod,bpt+1+smod
	add.f #-smod,@smod	;inc,scan
	sne.i *scan,@scan
	djn loop,{loop+66
	djn.f inc,scan
for 5
	dat 0,0
rof
	dat 6-scan,6-scan+267
inc:	spl #5-scan,-267 ;-175	;5-scan+267 ;-175	;#step,<-step
clr:	mov inc,>scan
	mov inc,}scan
bpt:	djn.a clr,<inc

	end scan

