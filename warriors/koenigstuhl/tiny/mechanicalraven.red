;redcode-tiny
;name Mechanical raven
;author G.Labarga
;assert CORESIZE==800
;strategy Bishot

	step equ 12

gate:	dat 544,163
	dat 0,0
	dat 0,0
dbm:	dat 588,(-gate+6)
clr:	spl #300,(-gate+6)
	mov @bptr,>gate
	mov @bptr,>gate
	mov @bptr,}gate
bptr:	djn.b -3,{clr
for 4
	dat 0,0
rof
loop:	add.f inc,@2
scan:	sne.i *gate,@gate
	add.f inc,gate
	sne.i *gate,@gate
	djn.f loop,@gate ;{gate-89
	djn.f clr,gate
inc:	dat >step,>step

end scan

