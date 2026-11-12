;redcode-RF20
;assert CORESIZE==8000
;name Bride of RoP
;author Chip Wendell
;strategy Create the paper from Revenge of the Papers

      org start

; ========================
; Pool C - 25 Instructions
; ========================

PC00   spl    @    3077 , <       2
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
PC12   jmz.f  $       1 , $      23
PC13   djn.x  $    1111 , <      29
PC14   djn.a  $      -4 , #    1000
PC15   spl    #      12 , #      31
PC16   add.ba #    2365 , $      -3
PC17   add.x  $       0 , $      37
PC18   slt.a  $     889 , $    1471
PC19   jmp    $   -2667 , $      41
PC20   mul.ab #      -8 , $      43
PC21   mov.i  #    3315 , *      47
PC22   mov.i  #      -1 , $      53
PC23   spl    $     152 , <    2936
PC24   jmn    $      -2 , @      59

;Changes to instruction pool:
;1) Change B-field addressing mode of PC00: 4 AP
;2) Joker of PC18 = 1471
;3) Joker of PC23 = 152
;Total AP used: 4


loc equ PC00 + 419

;Creator code
start mov.f  PC02,  PC03
      mov.i  #PC24, <loc+7
      mov.b  PC18,  PC00
      mov.a  PC17,  PC00
      mov.a  PC12,  loc+6

      mov.i  PC00,  >erase
      mov.i  PC03,  >erase
      djn.b  @PC11,  #3

      add.b  @PC09, loc+2
      sub.ab PC23,  loc+4
      mov.ab PC12,  loc+6
      mov.i  PC13,  loc+7
      mov.a  PC24,  loc+7
      mov.ab PC16,  loc+7

;Erase the pool, creator, and eraser code
erase spl 1, loc
      spl 1
      spl 1
      mov loc-1, >ptr
      mov loc-1, >ptr
      mov loc-1, >ptr
      mov loc-1, >ptr
      mov loc-1, >ptr
      mov loc-1, >ptr

ptr   jmp loc, PC00

      end
