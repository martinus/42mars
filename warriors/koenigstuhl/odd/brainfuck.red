;redcode-94odd
;name Brainfuck Interpreter (v0.3)
;author Roy van Rijn
;strategy Brainfuck Interpreter with self-reproduction program (aQuine)
;strategy It takes 7244366 cycles, removed the restricted memory (was
;strategy slowing this down)
;assert 1

LT      equ     60 ;<
GT      equ     62 ;>
INC     equ     43 ;+
DEC     equ     45 ;-
OUT     equ     46 ;.
IN      equ     44 ;,
OP      equ     91 ;[
CL      equ     93 ;]

lt      equ     dat LT  , cLT-START
gt      equ     dat GT  , cGT-START
inc     equ     dat INC , cINC-START
dec     equ     dat DEC , cDEC-START
out     equ     dat OUT , cOUT-START
in      equ     dat IN  , cIN-START
op      equ     dat OP  , cOP-START
cl      equ     dat CL  , cCL-START

;Use switch-table
cINC    add     #2              , @PTR          ;add 2 min 1
cDEC    sub     #1              , @PTR          ;min 1

START   mov.b   }PTR            , #0
       jmp     @-1

cLT     jmp     START           , <PTR
cGT     jmp     START           , >PTR

cOUT    mov.b   @PTR            , <6000         ;sts.b  @PTR
       jmp     START
cIN     mov.b   }INPUT          , @PTR   ; now using INPUT-table 
                                         ; instead or streams
       jmp     START

;Optimize by using a stack? remembering the layer+position?
cOP     jmn     START           , @PTR
opCheck sne.ab  *PTR            , #OP
       add     #1              , CNT1 ;Count nested brackets
       seq.ab  }PTR            , #CL
       jmp     opCheck
CNT1    djn.b   opCheck         , #1
       jmp     START           , >CNT1

cCL     jmz     START           , @PTR
       nop     {PTR            , >CNT2
clCheck sne.ab  {PTR            , #CL
       add     #1              , CNT2 ;Count nested brackets
       seq.ab  *PTR            , #OP
       jmp     clCheck
CNT2    djn.b   clCheck         , #0
       jmp     START

;Used to mimic keypresses (when not using exmars_streams)
INPUT   dat     0               , -1

PROGRAM

;Brainfuck Quine, unsure who wrote the original.... (not me anyway!)

dec
gt
inc
inc
gt
inc
inc
inc
gt
inc
gt
inc
gt
inc
inc
gt
gt
inc
gt
inc
gt
inc
inc
inc
gt
gt
inc
gt
inc
gt
inc
inc
gt
inc
inc
inc
gt
inc
inc
inc
gt
inc
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
inc
gt
inc
gt
inc
inc
gt
gt
gt
inc
inc
inc
gt
gt
gt
gt
gt
inc
inc
inc
gt
inc
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
gt
inc
inc
inc
gt
gt
gt
gt
gt
gt
gt
inc
inc
gt
inc
inc
inc
gt
inc
inc
inc
gt
inc
gt
gt
inc
inc
inc
gt
gt
gt
inc
inc
inc
gt
inc
gt
inc
inc
inc
gt
inc
gt
inc
inc
gt
inc
inc
inc
gt
gt
gt
inc
gt
inc
gt
inc
gt
inc
gt
inc
inc
gt
inc
inc
inc
gt
inc
gt
inc
gt
gt
inc
inc
inc
gt
gt
gt
gt
gt
gt
gt
inc
gt
inc
gt
gt
gt
inc
gt
inc
gt
inc
inc
gt
inc
inc
inc
gt
inc
inc
inc
gt
inc
gt
gt
inc
inc
inc
gt
inc
inc
inc
gt
inc
gt
inc
inc
inc
gt
inc
gt
inc
inc
gt
inc
inc
inc
gt
inc
inc
gt
gt
inc
gt
inc
gt
inc
inc
gt
inc
inc
inc
gt
inc
gt
inc
gt
gt
inc
inc
inc
gt
gt
gt
inc
inc
inc
gt
inc
gt
gt
gt
inc
inc
gt
inc
inc
inc
gt
inc
inc
inc
gt
inc
gt
gt
inc
inc
inc
gt
gt
gt
inc
inc
inc
gt
inc
gt
inc
inc
inc
gt
inc
gt
gt
inc
inc
inc
gt
gt
inc
inc
inc
gt
gt
inc
op
op
gt
gt
inc
op
gt
cl
inc
gt
inc
op
lt
cl
lt
dec
cl
gt
gt
op
gt
cl
lt
inc
lt
inc
inc
inc
op
lt
cl
lt
lt
inc
cl
gt
gt
inc
op
gt
cl
inc
inc
inc
op
inc
inc
inc
inc
inc
inc
inc
inc
inc
inc
gt
inc
inc
op
dec
lt
inc
inc
inc
inc
inc
inc
inc
inc
inc
inc
inc
inc
inc
inc
inc
inc
gt
cl
lt
out
lt
dec
lt
cl


EOF     dat     0               , -10   ; Halt
PTR     dat     #PROGRAM        , #1    ; A: Execution pointer, B: Data pointer

end START

