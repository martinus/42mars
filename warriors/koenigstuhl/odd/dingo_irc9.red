;redcode
;name Dingo IRC9
;author Philip Thorne
;stratgey Stone ~ try to make robust and non-suicidal
;assert 1
; CORESIZE==2520

STEP    EQU     771 ;mod 3

bbptr:  dat     {1,         }0
bptr:   dat     {STEP,      }-STEP

        spl     }0,         {0
stone:  spl     }0,         {0
        mov.i   <-10,       }bptr
        mov.i   {CORESIZE/2,{bptr
        nop     <iptr,      >bbptr
        add.f   >iptr,      <bbptr
        jmp     {0,         }0
        jmp     {0,         }0

    for 2
        dat     {0,         }0
    rof

iptr:   dat     {bptr,      }0

    end stone
