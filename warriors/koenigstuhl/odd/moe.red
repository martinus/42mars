;redcode
;name Moe
;author Sascha Zapf
;assert 1
;       CORESIZE==800
;strategy First entry for the 10th rd. of the Redcoders Frenzy Tournament.

bdis	EQU	543
step	EQU  236
gate	EQU 771
decoy1	EQU 218
decoy2	EQU 322
decoy3	EQU 190

; Stone

stone	spl		#0,	#5
bline	mov.i	}stone-4	, cc+step
		add.f	incr, bline
cc		jmp		bline, <gate
		mov.i	datb, >cc
datb	dat.f	<267,<5
incr	dat.f	-4,step

; Boot

boot	mov.i	}bptr,>bptr
		djn.b	-1,#7
		spl		stone+bdis

; Decoymaker

		mov.i	{decoy1,>decoy1+1
		mov.i	{decoy1+3,>decoy1+4
		mov.i	{decoy1+6,>decoy1+7

		mov.i	{decoy2,>decoy2+1
		mov.i	{decoy2+3,>decoy2+4
		mov.i	{decoy2+6,>decoy2+7

		mov.i	{decoy3,>decoy1+3
		mov.i	{decoy3+3,>decoy3+4
		mov.i	{decoy3+6,>decoy3+7

bptr	dat.f	stone,stone+bdis
		end boot
  
