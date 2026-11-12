;redcode-rf20
;name igor's two thumbs
;author el kauka
;assert 1
posi equ start+200
org run
start ; Pool C - 25 Instructions
PC00   spl    @    3077 , #       2
PC01   spl    $      -3 , #       3
PC02   mov.i  >      -1 , }      -1
PC03   mov.i  }      22 , >       5
PC04   dat    <    2667 , <    5334
PC05   mov.ab #       0 , >       7
PC06   sne.i  $    3044 , $    3364
PC07   sne.x  $      20 , $      11
PC08   seq.f  *    1143 , *      13
PC09   seq.b  $    1203 , <      17
PC10   mov.i  $    2376 , $      -7
PC11   mov.ab $       4 , @      19
PC12   jmz.f  $       1 , {      23 ;changed b-field addressing mode (original: $) -> 4 AP
PC13   djn.x  $    1111 , <      29
PC14   djn.a  $      -4 , #    1000
PC15   spl    #      12 , #      31
PC16   add.ba #    2365 , $      -3
PC17   add.x  $       0 , $      37
PC18   slt.a  $     889 , $       0
PC19   jmp    $   -2667 , >      41 ;changed b-field addressing mode (original: $) -> 4 AP
PC20   mul.ab #      -8 , $      43
PC21   mov.i  $    3315 , *      47 ;flip a-field addressing mode (original: #) -> 2AP
PC22   mov.i  #      -1 , $      53
PC23   spl    $       0 , <    2936
PC24   jmn    $      -2 , @      59
;#########################
;p code -  a simple switch-on-loss
run	ldp	#0,	0
	ldp.a	#2,	5
	sne.ab	-2,	-2
	add.a	#1,	3
	mod.a	#2,	2
	add.a	#1,	1
	jmp	0,	0
	jmp	ps1
	jmp	ps2
;p strategy 1 - paper-bomber
ps1	stp	#0,	#2
;#########################
;creator code 1
;spl.b	$ 2362,	 # 0
;mov.i	> -1,	} -1
;jmn.b	$ -2,	@ -2
;mov.i	$ 4,	$ 19
;jmp.b	$ -1,	> -1
mov.i	PC01, posi
add.f	PC16, posi
mov.i	PC02, posi+1
mov.i	PC24, posi+2
mov.ab	PC24, posi+2
mov.i	PC10, posi+3
mov.f	PC11, posi+3
mov.i	PC19, posi+4
mov.f	PC02, posi+4
;#########################
jmp clear
;p strategy 1 - flash scaner
ps2	stp	#1,	#2
;#########################
;creator code 2
;jmz.f	$ 0,	{ -7
;mov.i	$ 43,	* -8
;jmp.b	$ -2,	> 59
mov.i	PC12, posi
mov.a	PC17, posi
mov.b	PC10, posi
mov.i	PC21, posi+1
mov.x	PC20, posi+1
mov.i	PC19, posi+2
mov.f	PC24, posi+2
;#########################
;the clear code
clear	mov.i	3,	>2
	jmn.f	-1,	-1	;this instruction is not erased by the clear -> for 1 AP
;the jmp-instruction
jmp posi, start
;-----------------------
;11 AP - 4 AP left
end

