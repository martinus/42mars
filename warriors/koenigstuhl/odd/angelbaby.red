;redcode-94 test
;name Angelbaby
;author Harbinger Of Doom
; <slavearc@hotmail.com>
;strategy scan and lay pinpointed bombs
;assert CORESIZE==8000

ptr         DAT     #14,#0
start       add.a    #4,ptr
              sne.a     0,}ptr
              mov      #14,ptr
              sne.i      }ptr,@scn
scn         jmp       start,#3
              mov.i     ptr,}ptr
              jmp       start
end        start
