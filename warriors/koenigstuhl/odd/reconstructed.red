;redcode-RF20
;assert CORESIZE==8000
;name Recon-structed
;author Chip Wendell
;strategy Duplicate Recon 2, as closely as possible

      org start

; ========================
; Pool C - 25 Instructions
; ========================                ;Here's the end result:

PC00   spl    @    3077 , #       2		;00 DAT.F  <3870  ,   <19
PC01   spl    $      -3 , #       3		;01 SPL.B  #6557  ,   #6557
PC02   mov.i  >      -1 , }      -1		;02 MOV.I  *3     ,   >-5  
PC03   mov.i  *      22 , >       5		;03 MOV.I  *2     ,   >-6  
PC04   dat    <    2667 , <    5334		;04 DJN.A  $-2    ,   $-5
PC05   mov.ab #       0 , >       7		;05 ADD.X  $-4    ,   $1 
PC06   sne.i  $    3044 , $    3364		;06*SNE.I  $5113  ,   $5107 
PC07   sne.x  $      20 , $      11		;07 ADD.X  $-6    ,   $-1 
PC08   seq.i  *    1143 , @      13		;08 SEQ.I  *-2    ,   @-2 
PC09   seq.b  $    1203 , <      17		;09 SLT.A  #20    ,   $-3
PC10   mov.i  $    2376 , $      -7		;10 DJN.A  $-5    ,   $-10
PC11   mov.ab $       4 , @      19		;11 MOV.AB $-5    ,   @-9 
PC12   jmz.f  $       1 , $      23		;12 MOV.I  #7     ,   $-13
PC13   djn.x  $    1111 , <      29		;13 JMN.A  $-11   ,   @-3
PC14   djn.a  $      -4 , $    1000		;14 MOV.I  $-14   ,   $-8
PC15   spl    #      12 , #      31		;15 DJN.A  $-14   ,   $-10
PC16   add.ba #    2365 , $      -3	
PC17   add.x  $       0 , $      37	
PC18   slt.a  #     889 , $    6557	
PC19   jmp    $   -2667 , $      41	
PC20   mul.ab #      -8 , $      43	
PC21   mov.i  #    3315 , *      47	
PC22   mov.i  #      -1 , $      53	
PC23   spl    $    5113 , <    2936	
PC24   jmn.a  $      -2 , @      59

;Changes to instruction pool:
;1) Change A-field addressing mode of PC03: 4 AP
;2) Change modifier of PC08 to i: 3 AP
;3) Flip B-field addressing mode of PC08: 2 AP
;4) Flip B-field addressing mode of PC14: 2 AP
;5) Flip A-field addressing mode of PC18: 2 AP
;6) Flip modifier of PC24: 2 AP
;7) Joker of PC18 = 6557
;8) Joker of PC23 = 5113
;Total AP used: 15 (tapped out!)


start mov.i  #PC18, PC12
      mov.ba PC05,  PC12
      mov.f  <PC10, PC08
      mov.i  PC04,  PC00
      add.a  PC09,  PC00
      mov.b  PC11,  PC00
      mov.a  #PC17, PC10
      mov.a  PC24,  PC14
      mov.a  #PC22, PC24
      sub.f  PC07,  PC03
      mov.i  PC03,  PC02
      sub.f  PC08,  PC02
      add.f  PC08,  PC08
      mov.b  PC02,  PC14
      mov.i  PC14,  PC04
      mov.i  PC10,  PC14
      mov.a  PC07,  PC18
      mov.i  PC04,  PC10
      add.f  PC10,  PC10
      mov.ba PC03,  PC17
      mov.ab PC22,  PC17
      mov.i  PC17,  PC07
      mov.i  PC17,  {PC10
      mov.f  PC10,  PC11
      mov.i  PC15,  >PC11
      mov.ba PC18,  PC01
      mov.b  PC18,  PC01
      sub.f  PC08,  PC05
      mov.a  PC23,  PC06
      mov.ab PC23,  PC06
      add.b  PC03,  PC06
      mov.i  PC18,  PC09
      mov.b  PC16,  PC09
      mov.i  PC10,  PC15
      mov.a  PC14,  PC15
      mov.i  PC24,  PC13
      mov.b  PC16,  PC13

;Erase the pool and creator code
erase mov ptr+1, >ptr
      mov ptr+1, >ptr
      mov ptr+1, >ptr
      mov ptr+1, >ptr
      mov ptr+1, >ptr
      djn erase, #10
      spl 1
      mov ptr+1, >ptr
      mov ptr+1, >ptr
      mov ptr+1, >ptr
      mov ptr+1, >ptr

ptr   jmp PC06, PC16

