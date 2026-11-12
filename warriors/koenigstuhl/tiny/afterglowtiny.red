;redcode-tiny
;name Afterglow
;author John Metcalf
;strategy table scan -> sunset style paper
;assert CORESIZE==800

        org    scan

        step   equ 442
        off    equ table+589

        spl    {off+step*1,<off+step*1+19
        spl    {off+step*2,<off+step*2+19
        spl    {off+step*3,<off+step*3+19
        spl    {off+step*4,<off+step*4+19
        spl    {off+step*5,<off+step*5+19
        spl    {off+step*6,<off+step*6+19
table   spl    {off+step*7,<off+step*7+19

scan    sne    {table,     >table
        djn.f  <0,         >0
        jmn.f  warr,       table-7
        add    @scan,      }0

clear   mov    }scan,      <scan
        mov    <scan,      }scan
        djn    clear,      #17

warr    spl    1,          <704
        spl    1,          <565

        pstep  equ 84

paper   spl    pstep,      {src
        mov    }src,       }paper
src     mov    *paper+4,   }paper
        jmz.f  @paper+2,   *src

        end

