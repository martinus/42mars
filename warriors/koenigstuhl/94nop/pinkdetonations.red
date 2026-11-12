;redcode-94nop
;name Pink Detonations
;author Ken Espiritu
;strategy q^4 -> paper
;assert 1

factor equ 5844
qA equ 791
qB equ 498
qC equ 4129
qD equ 3836
qE equ 3543
qF equ 7326
;mdelta 96 err 7.018182 pDe 96 pA 66 pB 67 pC 0 pD 1 pE 2 pF 71

qs equ  5;7
qt equ  16;16
qo equ  58;40
org qscan

boot	spl.b  $    1 , {qC
table2	mov.i  {    0 , #qD
	mov.i  {    0 , #qE
	spl.b  $    1 , <  5457
	mov.i  {    2 , {     1
	spl.b  $ 6052 , {  1497
	spl.b  @   10 , }  6287
	mov.i  } 7999 , >  7999
	spl.b  @    0 , {  1015
	mov.i  } 7999 , >  7999
	spl.b  @    0 , }  3408
	mov.i  } 7999 , >  7999
	mov.i  # 2763 , <     1
	mov.i  $ 7999 , }  2146
	mov.i  # 2486 , <     1
	mov.i  $ 7999 , <  2398

for 29
dat 0,0
rof

qscan   seq dest+factor, dest+factor+qD ;1
    	jmp decide, {dest+factor+qs

        sne dest+factor*qA, dest+factor*qA+qD ;2
        seq <table1-1, dest+factor*(qA-1)+qD
        djn.a decode, {decode

        sne dest+factor*qB, dest+factor*qB+qD ;3
        seq <table1, dest+factor*(qB-1)+qD
        jmp decode, {decode

        sne dest+factor*qC, dest+factor*qC+qC	;4
        seq <table2-1, dest+factor*(qC-1)+(qC-1)
        jmp decode, {decode+2

        sne dest+factor*qE, dest+factor*qE+qE	;5
        seq <table2+1, dest+factor*(qE-1)+(qE-1)
        jmp decode, }decode+2

        seq dest+factor*(qC-2), dest+factor*(qC-2)+(qC-2) ;6
        djn decode, {decode+2

        sne dest+factor*qF, dest+factor*qF+qD ;7
        seq <qbomb, dest+factor*(qF-1)+qD
        jmp decode, }decode

        sne dest+factor*qD, dest+factor*qD+qD ;8
        seq <table2, dest+factor*(qD-1)+(qD-1)
        jmp decode, <qA
table1  djn.f boot, #qB

for 3
dat 0,0
rof

qbomb 	dat    {qo            , qF

for 20
dat 0,0
rof

decode	mul.b  *2               , dest		;  a-field of table1 must
decide	sne    {table1           , @dest	;<-point to dat
      	add.b  table2            , dest
ql    	mov    qbomb            , @dest
dest  	mov    qbomb            , }factor
      	sub    #qs           , @decide
      	djn    ql            , #qt
      	djn.f  boot              , #0
end


