;redcode-94
;name Like glicerine for constipation
;author G.Labarga
;assert 1
;       CORESIZE==8000 && MAXLENGTH==200
;strategy Redcoders Frenzy Tournament, "Laughing-Loser Round". Sep.28th, 2003
;strategy Entry#1
;strategy		/- vampiric scan -> bombing CLP
;strategy P-switching: <
;strategy		\- scanning-clear decoy, (vamp-bombing) -> bombing CLP

pin 7

	dest equ 2412+1

;------------------------ vampiric scanner
	dir equ 3+170

atk:	sub.ba ptr,vbmb
	mov vbmb,@ptr
	mov.ba vbmb,vbmb
loop:	add.ab #170,@scan
scan:	jmz.a loop,@ptr
	mov.b ptr,bpt
ptr:	sne.a #-2,@dir
	jmp bfld
bpt:	seq.a #-2,*0
	jmp @0,atk
afld:	add.ab @ptr,>1
bfld:	add.b @ptr,ptr
	add.ab #2,ptr
	add.b ptr,chk+1
go:	jmp setr
for 26
	dat 0,0
rof

;-------------------------------- CLP trap
	pdest equ 2048+1

ppt:	mov.ab #plast+1,#plast+1
psetr:	mov.ab #0,psetf-20
psetf:	mov.ab #0,plast+20
pchk:	jmn.b pcopy,@psetr
	jmz.b pchk,@psetf
pcopy:	mov <ppt,<plast
	jmn.b pcopy,ppt
plast:	jmp @0,pdest
for 5
	dat 0,0
rof
vbmb:	jmp ppt-ptr,ppt-ptr	;scanner's vamp bomb
for 13
	dat 0,0
rof
;----------------------- P-Brain: switches strategies after 2 consecutive non-winning results
	NCHECK equ 1234
	D_CHECK equ 2
	D_STATE equ 1
	strat2 equ scan
	strat1 equ decoy

start:	stp.ab #NCHECK,#D_CHECK
	ldp.a #0,result
	ldp.a 2,state
	mod.ba *result,state
	stp.b *state,#D_STATE
state:	jmp }0,#13		;state0; only when start: strat1 (clear), fast switch
table:	spl #strat1,#7		;state1: strat1, (clear)
	spl #strat1,#13		;state2: strat1, (clear)
	spl #strat2,#9		;state3: strat2, (scan)
	spl #strat2,#21		;state4: strat2, (scan)
	nop -2,5		;table for results and little decoy
	nop 0,5
	nop -2,5
result:	nop 0,5
	nop -2,5
	nop -2,5
	jmp *-2,6
for 17
	dat 0,0
rof
;--------------------------------- scanning-clear's check, (a bit too big)

xchg:	jmn 2,@ptd		;checks the contact
	mov.x ptd,ptd
	add.b ptd,pta
	add.b ptd,ptb
pta:	sne.a #-2,@ptd
	jmp bfld2
ptb:	seq.a #-2,*ptd
	jmp @0,vamp		;jumps to vamp
afld2:	add.ab @pta,>1
bfld2:	add.b @pta,pta
	add.ab #2,pta
	add.b pta,@1
	add.ab #pta-ptr,chk+1
	mov vbmb2,gotcha	;vamp confused opponents
	jmp setr		;jumps to CLP
for 5
	dat 0,0
rof
vbmb2:	jmp ppt-ptd+1,ppt-ptd+1
for 12
	dat 0,0
rof
;-------------------------- decoy scanning clear
vamp:	sub.ba ptd,vbmb2
	mov vbmb2,@ptd		;vamp bombing :)
	mov.ba vbmb2,vbmb2
	slt.ba ptd,ptd
	mov.x @0,ptd
	mov.ab #ptd-pta,pta	;reload offset in pointers
	mov.ab #ptd-ptb,ptb
	add.f #-5,@5
	jmn.f xchg,@ptd
decoy:	mov @xchg,>ptd		;scanning-clear decoy
	jmn.f *-1,{ptd		;found something backwards?
	mov ptd,*ptd
cnt:	jmz.f *-2,@ptd		;found something frontwards?
	jmp xchg,-xchg
gotcha:	dat 0,0			;confused opponents will be waiting here
ptd:	dat -306,303		;<- tweak

for (MAXLENGTH-CURLINE)-13
	dat 0,0
rof
;-------------------------------- bombing CLP
mptr:	mov.ab #stuck+1,#stuck+1
setr:	mov.ab #0,setf-30
setf:	mov.ab #0,stuck+30
chk:	mov.i stuck,@1
	jmz.b stuck+1,@ptr
	jmn.b mdfy,@setr
	jmz.b chk,@setf
mdfy:	sub.ab #dest-2,chk+1
copy:	mov <mptr,{last
	jmn.b copy,mptr
last:	jmp dest,}dest-2
stuck:	jmp #0,-2

	end start
