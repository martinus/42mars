;redcode-tiny
;name Screeching soundcard
;author G.Labarga
;assert CORESIZE==800
;strategy Oneshot scanner

decoy equ loop-87
sstep equ 13
d1 equ loop+(4*sstep)
d2 equ loop+(3*sstep)

loop:	sub.f inc,scan
	mov bm,@scan
scan:	sne.i }d1,*d2
	djn.b loop,<decoy

inc:	spl #-(3*sstep),>-(3*sstep)
	mov @bptr,>scan
	mov @bptr,>scan
	mov @bptr,>scan
bptr:	djn.f -3,{sbm
dbm:	dat -20,(14)
sbm:	spl #-100,(14)
bm:	mov >(2*sstep),1

end scan

