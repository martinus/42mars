;redcode-rf23
;author John K. Lewis
;strategy not sure.
;name Cloe XL
;assert 1


org paper

flag	dat 	1,0
paper   mov.ab  #target-paper+2,#target-paper+2         ;
counter	djn.a	0,flag
copy    mov.i   <paper,<ptr   			;
         jmn.b   copy,paper   			;
 	spl.a	start
ptr     jmp.a   @0,25000-target-paper    ;
start	mov.a #1, <ptr
 	mov *target,<target		;
 	mov *target,<target		;
 	jmp.a -2			;
bomb	spl #-12,24001			;
target	dat bomb,24000			;

