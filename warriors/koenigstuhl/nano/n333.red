;redcode-nano
;name Dark Blue Bean
;author Christian Schmidt
;strategy silk with silk imps
;assert 1

pStp   equ   23
pBmb1  equ   33
pBmb2  equ   24
pBmb3  equ   32
pBmb4  equ   27
pBmb5  equ   69
pBmb6  equ   44

        spl.x   # pBmb1,  }pBmb2
        mov.i   } pBmb3,  <pBmb4
        mov.i   imp,      imp+40
        spl     imp+40,   }pBmb5
imp     mov.i   #pBmb6,   41

       end
