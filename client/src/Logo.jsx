import React from 'react';

export default function Logo({ subtitle = 'STUDENT FINANCE', className = '' }) {
  return (
    <div className={`brand ${className}`.trim()}>
      <img
        className="brandIcon"
        src={`${import.meta.env.BASE_URL}pluscode-logo.jpeg`}
        alt=""
        width={48}
        height={48}
      />
      <div>
        <strong>pluscode</strong>
        <small>{subtitle}</small>
      </div>
    </div>
  );
}
