;redcode-94nop
;name The lucky shot
;author G.Labarga
;assert CORESIZE==8000 || CORESIZE==800 || CORESIZE==55440
;strategy Oneshot scanner
;strategy After hours of testing i found the easiest way to achieve
;strategy - an acceptable score for tiny/standard/big settings is to
;strategy - write just a oneshot scanner.
;strategy - Unfortunately that left me almost no time for optimization.

	smod EQU 10
	d1 EQU (2*sstep)+smod
	d2 EQU (2*sstep)
for CORESIZE==55440
	sstep EQU (smod*679)
rof
for CORESIZE==8000
	sstep EQU (smod*381)
rof
for CORESIZE==800
	sstep EQU (smod*1847)
rof
gate:	dat scan+d1,scan+d2
for 2
	dat 0,0
rof
sw:	dat <1,(clr+6-gate)
sbm:	spl #clr+20,(clr+7-gate)
for 2
	dat 0,0
rof
clr:	spl #(2*sstep),>(2*sstep)
clop:	mov *sw,>gate
	mov *sw,>gate
	djn.f clop,}sbm
for 10
	dat 0,0
rof
loop:	add.f clr,@scan+1
scan:	sne.i *gate,@gate
	djn.f loop,@gate
	djn.f clr,@scan+1
end scan


