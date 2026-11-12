;redcode-94
;name Glicerine assistant
;author G.Labarga
;assert 1
;       CORESIZE==8000 && MAXLENGTH==200
;strategy Redcoders Frenzy Tournament, "Laughing-Loser Round". Sep.28th, 2003
;strategy Entry#2
;startegy scanning-clear decoy, (vamp-bombing) -> bombing clp
;strategy Loses against entry #1

pin 7

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
for 5
	dat 0,0
rof
xchg:	jmn 2,@ptd
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
	add.b pta,chk+1
	mov vbmb2,gotcha	;vamp confused opponents
	jmp mptr		;jumps to CLP
for 5
	dat 0,0
rof
vbmb2:	jmp ppt-ptd+1,ppt-ptd+1
for 26
	dat 0,0
rof
	pdest equ 2048+1

ppt:	mov.ab #plast+1,#plast+1	;CLP trap
psetr:	mov.ab #0,psetf-20
psetf:	mov.ab #0,plast+20
pchk:	jmn.b pcopy,@psetr
	jmz.b pchk,@psetf
pcopy:	mov <ppt,<plast
	jmn.b pcopy,ppt
plast:	jmp @0,pdest
for 26
	dat 0,0
rof
;------------------------- P-check 
	NCHECK equ 1234
	D_CHECK equ 2

start:	nop -2,0
	ldp.ab #D_CHECK,#0
	seq.ab #NCHECK,-1
	jmp decoy
	mov.a #100,}ptb
	jmp psetr,}cnt

for (MAXLENGTH-CURLINE)-12
	dat 0,0
rof
	dest equ 2412+1

mptr:	mov.ab #stuck+1,#stuck+1	;Bombing CLP
setr:	mov.ab #0,setf-30
setf:	mov.ab #0,stuck+30
chk:	mov.i stuck,@1
	jmz.b stuck+1,@pta
	jmn.b mdfy,@setr
	jmz.b chk,@setf
mdfy:	sub.ab #dest-2,chk+1
copy:	mov <mptr,{last
	jmn.b copy,mptr
last:	jmp dest,}dest-2
stuck:	jmp #0,-2

	end start

