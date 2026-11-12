;redcode-rf20
;author Joshua
;name Frankenstein's Imp
;strategy Imp spiral with bizarre thread placement
; Changed PC16 address mode from .ba to .a: 3
; One instruction isn't cleared: 1
; AP charged: 4
; AP remaining: 11
;assert 1

J1 equ 3
J2 equ 2

PC00   spl    @    3077 , #       2     ; SPL #X, !X
PC01   spl    $      -3 , #       3     ; SPL 2, !X
PC02   mov.i  >      -1 , }      -1     ; JMP 3, !X
PC03   mov.i  }      22 , >       5     ; ADD.A #1143, -1
PC04   dat    <    2667 , <    5334
PC05   mov.ab #       0 , >       7     ; MOV.I #X, 1143
PC06   sne.i  $    3044 , $    3364
PC07   sne.x  $      20 , $      11
PC08   seq.f  *    1143 , *      13
PC09   seq.b  $    1203 , <      17
PC10   mov.i  $    2376 , $      -7
PC11   mov.ab $       4 , @      19
PC12   jmz.f  $       1 , $      23
PC13   djn.x  $    1111 , <      29
PC14   djn.a  $      -4 , #    1000
PC15   spl    #      12 , #      31
PC16   add.a  #    2365 , $      -3     ; was ba, charge 4
PC17   add.x  $       0 , $      37
PC18   slt.a  $     889 , $      J1
PC19   jmp    $   -2667 , $      41
PC20   mul.ab #      -8 , $      43
PC21   mov.i  #    3315 , *      47
PC22   mov.i  #      -1 , $      53
PC23   spl    $      J2 , <    2936
PC24   jmn    $      -2 , @      59

stimp  MOV.I  PC23, PC01
       MOV.I  PC15, PC00
       MOV.I  PC19, PC02
       MOV.BA PC18, PC02

       MOV.I  PC22, PC05
       MOV.AB PC08, PC05

       MOV.I  PC16, PC03
       MOV.AB PC22, PC03
       MOV.BA PC05, PC03

       MOV.A  PC12, PC23

       SPL    1
       SPL    1
       MOV.I  50, >px               ; A clear instruction
       SPL    1

; Clear generator and rest of pool
for 4
       MOV.I  50, >px               ; Last mov instr not cleared, charge 1
rof

px     JMP    PC00, PC06
end stimp

