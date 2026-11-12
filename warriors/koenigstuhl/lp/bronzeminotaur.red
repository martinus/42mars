;redcode-ln
;name Bronze minotaur
;author G.Labarga
;assert 1
;strategy Paper/stone

org boot

pinit1 equ 5741
bstep1 equ 1171
bstep2 equ 826
increm1 equ 2903
pinit2 equ 6415
increm2 equ 155

src1:	mov.ab #7+13,#7
loop1:	mov.i <src1,{dst1
	mov.i {bstep1,{bstep2 
	add.f {0,}0
	jmn.b loop1,src1
	spl @src1,>increm1
dst1:	jmz.b pinit1,*0
blank equ 63
for blank
	dat 0,0
rof
boot:	spl loop1,>7573
	jmp loop2,>1473
for 121
	dat 0,0
rof
src2:	mov.ab #7+10,#7
loop2:	mov.i <src2,{dst2
	mov.i {bstep1,{bstep2 
	add.f {0,}0
	jmn.b loop2,src2
	spl @src2,>increm2
dst2:	jmz.b pinit2,*0

end

