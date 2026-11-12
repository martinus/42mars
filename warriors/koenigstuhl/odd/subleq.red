;redcode-94odd
;name SUBLEQ Hello World
;author Roy van Rijn
;assert 1
;----------------
; Implementation of the OISC SUBLEQ interpreter.
; All instructions take 3 lines:
; dat A,0
; dat B,0
; dat C,0
;
; The interpreter works as following:
;
; Substract A from B
; If B is less or equal to zero jump to C
; Else go to the next instruction (+3)
;
; If the jump is to HALT (-1) the program will halt
; If the substraction is OUT (-2) the program will output the amount
; substracted
;----------------
HALT    equ     -1
OUT     equ     -2

;Pointers used by program:

EQ     dat     PROGRAM-1       , PROGRAM
PTR    dat     PROGRAM         , PROGRAM+1
RESETV dat     PROGRAM-SUBSTR  , PROGRAM-SUBSTR ;reset values
NEXTV  dat     #3              , #3

;Print to command line:
PRINT  mov.ab  *SUBSTR         , #0
      mov.b   -1              , <1000 ;sts.b -1,0 for output

;Reset to absolute values:
NEXT   add.f   NEXTV           , PTR
RESET  mov.f   RESETV          , SUBSTR

;Main logic:
START  add.a   *PTR            , SUBSTR
      add.ab  >PTR            , SUBSTR
      mov.a   @PTR            , NEWPTR

;Check if output is OUT, print and go to next instruction:
      mov.a   <PTR            , 1
      sne.ab  #0              , #OUT
      jmp     PRINT

;Substract and determine if the value <= 0
SUBSTR sub.a   PROGRAM         , PROGRAM
      slt.a   #CORESIZE/2     , @-1
      jmn.ba  NEXT            , @-2

;Jump to new address:
NEWPTR mov.ab  #0              , #0
      mov.f   NEWPTR          , PTR
      add.f   EQ              , PTR
      seq.ab  NEWPTR          , #HALT ;Check for HALT (jump to DAT-PROGRAM)
      jmp     RESET

LABEL
PROGRAM

;----------------
;Translated version of the Hello World program from:
;http://mozaika.com.au/oleg/subleq/

      dat A-LABEL,0
     dat A-LABEL,0
      dat 3,0

      dat p-LABEL,0
      dat Z-LABEL ,0
      dat 6,0

      dat Z-LABEL ,0
      dat A-LABEL ,0
      dat 9,0

      dat Z-LABEL ,0
      dat Z-LABEL ,0
      dat A-LABEL,0

A       dat PROGRAM ,0
      dat OUT ,0
      dat 15,0

      dat m1-LABEL,0
      dat p-LABEL,0
      dat 18,0

      dat A-LABEL ,0
      dat A-LABEL ,0
      dat 21,0

      dat E-LABEL ,0
      dat Z-LABEL ,0
      dat 24,0

      dat Z-LABEL ,0
      dat A-LABEL ,0
      dat 27,0

      dat Z-LABEL,0
      dat Z-LABEL,0
      dat 30,0

      dat b-LABEL,0
      dat b-LABEL,0
      dat 33,0

      dat p-LABEL,0
      dat Z-LABEL,0
      dat 36,0

      dat Z-LABEL ,0
      dat b-LABEL,0
      dat 39,0

      dat Z-LABEL,0
      dat Z-LABEL,0
      dat 42,0

      dat E-LABEL,0
      dat b-LABEL,0
      dat 48,0 ;?+3

      dat Z-LABEL ,0
      dat Z-LABEL,0
      dat 51,0 ;?+3

      dat p-LABEL,0
      dat A-LABEL,0
      dat 54,0 ;?+3

      dat Z-LABEL ,0
      dat Z-LABEL ,0
      dat 0,0

      dat 0 ,0
      dat 0 ,0
      dat -1,0

;data
p       dat H-LABEL,0
Z       dat 0,0
m1      dat -1,0
b       dat 0,0
H       dat 72,0        ;:H
      dat 101,0       ; e
      dat 108,0       ; l
      dat 108,0       ; l
      dat 111,0       ; o
      dat 32,0        ; space
      dat 87,0        ; W
      dat 111,0       ; o
      dat 114,0       ; r
      dat 108,0       ; l
      dat 100,0       ; d
E       dat E-LABEL,0

end START

